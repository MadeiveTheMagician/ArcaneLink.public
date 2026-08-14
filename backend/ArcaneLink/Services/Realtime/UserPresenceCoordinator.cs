using System.Collections.Concurrent;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Realtime;

public sealed class UserPresenceCoordinator : IUserPresenceCoordinator
{
    private const int MaxPublishAttempts = 2;
    private static readonly TimeSpan[] ReconciliationRetryDelays =
    [
        TimeSpan.FromMilliseconds(100),
        TimeSpan.FromMilliseconds(500),
        TimeSpan.FromSeconds(2)
    ];

    // States intentionally live for the process lifetime. This keeps one stable
    // serialization gate per user and is bounded by users seen by this instance,
    // rather than by connections or reconnect attempts.
    private readonly ConcurrentDictionary<Guid, UserPresenceState> _states = [];
    private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _mutationGates = [];
    private readonly ConcurrentDictionary<UserPresenceTopologyKey, SemaphoreSlim>
        _topologyGates = [];
    private readonly RealtimeConnectionRegistry _connections;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<UserPresenceCoordinator> _logger;
    private readonly TimeSpan _disconnectGrace;

    public UserPresenceCoordinator(
        RealtimeConnectionRegistry connections,
        IServiceScopeFactory scopeFactory,
        TimeProvider timeProvider,
        IOptions<RealtimePresenceOptions> options,
        ILogger<UserPresenceCoordinator> logger)
    {
        _connections = connections;
        _scopeFactory = scopeFactory;
        _timeProvider = timeProvider;
        _logger = logger;
        if (options.Value.DisconnectGraceSeconds is < 0 or > 300)
        {
            throw new ArgumentOutOfRangeException(
                nameof(options),
                "Disconnect grace must be between 0 and 300 seconds.");
        }

        _disconnectGrace = TimeSpan.FromSeconds(
            options.Value.DisconnectGraceSeconds);
    }

    public async Task ConnectionRegisteredAsync(
        RealtimeConnectionRegistrationResult registration,
        CancellationToken cancellationToken = default)
    {
        if (!registration.WasAdded)
        {
            return;
        }

        if (registration.PreviousUserId is { } previousUserId &&
            registration.PreviousUserLostLastConnection)
        {
            await ScheduleDisconnectAsync(
                previousUserId,
                cancellationToken);
        }

        if (registration.IsFirstConnection)
        {
            await ExecuteSerializedBestEffortAsync(
                registration.UserId,
                HandleFirstConnectionAsync,
                cancellationToken);
        }
    }

    public Task ConnectionUnregisteredAsync(
        RealtimeConnectionUnregistrationResult unregistration,
        CancellationToken cancellationToken = default)
    {
        return unregistration.WasLastConnection
            ? ScheduleDisconnectAsync(
                unregistration.UserId,
                cancellationToken)
            : Task.CompletedTask;
    }

    public Task SettingsChangedAsync(
        Guid userId,
        UserPresenceConfiguration previous,
        UserPresenceConfiguration current,
        CancellationToken cancellationToken = default)
    {
        var normalizedPrevious = UserPresenceConfiguration.Create(
            previous.Visibility,
            previous.ShowLastSeen,
            previous.Mode);

        return ExecuteSerializedBestEffortAsync(
            userId,
            (state, token) => HandleSettingsChangedAsync(
                userId,
                state,
                normalizedPrevious,
                token),
            cancellationToken);
    }

    public async Task AudienceChangedAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken = default)
    {
        foreach (var userId in userIds
                     .Where(id => id != Guid.Empty)
                     .Distinct())
        {
            if (!_states.TryGetValue(userId, out var state))
            {
                continue;
            }

            await ExecuteSerializedBestEffortAsync(
                state,
                HandleAudienceChangedAsync,
                cancellationToken);
        }
    }

    public async Task ExecuteMutationAsync(
        IEnumerable<Guid> userIds,
        Func<CancellationToken, Task> mutation,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(mutation);

        await using var lease = await EnterMutationGatesAsync(
            userIds,
            cancellationToken);
        await mutation(cancellationToken);
    }

    public async Task<IReadOnlyList<Guid>> ExecuteTopologyMutationAsync(
        UserPresenceTopologyKey topologyKey,
        IEnumerable<Guid> explicitUserIds,
        Func<CancellationToken, Task<IReadOnlyCollection<Guid>>> resolveActiveUserIds,
        Func<CancellationToken, Task> mutation,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(topologyKey.Scope);
        if (topologyKey.ResourceId == Guid.Empty)
        {
            throw new ArgumentException(
                "Presence topology resource id is required.",
                nameof(topologyKey));
        }
        ArgumentNullException.ThrowIfNull(resolveActiveUserIds);
        ArgumentNullException.ThrowIfNull(mutation);
        var explicitIds = explicitUserIds
            .Where(userId => userId != Guid.Empty)
            .Distinct()
            .ToArray();

        var topologyGate = _topologyGates.GetOrAdd(
            topologyKey,
            static _ => new SemaphoreSlim(1, 1));
        await topologyGate.WaitAsync(cancellationToken);
        try
        {
            var beforeUserIds = (await resolveActiveUserIds(cancellationToken))
                .Where(userId => userId != Guid.Empty)
                .Distinct()
                .ToArray();
            var protectedUserIds = beforeUserIds
                .Concat(explicitIds)
                .Where(userId => userId != Guid.Empty)
                .Distinct()
                .Order()
                .ToArray();

            await using (await EnterMutationGatesAsync(
                             protectedUserIds,
                             cancellationToken))
            {
                await mutation(cancellationToken);
                var afterUserIds = (await resolveActiveUserIds(cancellationToken))
                    .Where(userId => userId != Guid.Empty)
                    .Distinct()
                    .ToArray();
                var unexpectedUserIds = afterUserIds
                    .Except(protectedUserIds)
                    .ToArray();
                if (unexpectedUserIds.Length > 0)
                {
                    _logger.LogCritical(
                        "Presence topology mutation introduced users outside its protected mutation gates. Scope={Scope} ResourceId={ResourceId} UnexpectedUserCount={UnexpectedUserCount}",
                        topologyKey.Scope,
                        topologyKey.ResourceId,
                        unexpectedUserIds.Length);
                }

                return beforeUserIds
                    .Concat(afterUserIds)
                    .Concat(explicitIds)
                    .Where(userId => userId != Guid.Empty)
                    .Distinct()
                    .Order()
                    .ToArray();
            }
        }
        finally
        {
            topologyGate.Release();
        }
    }

    private Task ScheduleDisconnectAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return ExecuteSerializedBestEffortAsync(
            userId,
            (state, unusedToken) =>
            {
                if (_connections.HasConnections(userId) ||
                    !state.IsAnnouncedOnline ||
                    state.PendingDisconnect != null)
                {
                    return Task.CompletedTask;
                }

                var pendingDisconnect = new CancellationTokenSource();
                state.PendingDisconnect = pendingDisconnect;
                _ = CompleteDisconnectAfterGraceAsync(
                    userId,
                    state,
                    pendingDisconnect);
                return Task.CompletedTask;
            },
            cancellationToken);
    }

    private async Task HandleFirstConnectionAsync(
        UserPresenceState state,
        CancellationToken cancellationToken)
    {
        CancelPendingDisconnect(state);
        if (!_connections.HasConnections(state.UserId))
        {
            return;
        }

        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await GetActiveUserAsync(
            db,
            state.UserId,
            cancellationToken);
        if (user == null)
        {
            ResetReconciliationRetryUnderGate(state);
            return;
        }

        var configuration = GetConfiguration(user);
        var audience = await ResolveAudienceAsync(
            scope.ServiceProvider,
            user.Id,
            cancellationToken);
        var currentRecipients = audience
            .GetRecipients(configuration.Visibility)
            .ToHashSet();

        if (state.LastRecipients == null &&
            !state.IsAnnouncedOnline &&
            configuration.Mode == PresenceModeCodes.Invisible)
        {
            SetLastSnapshot(state, configuration, currentRecipients);
            ResetReconciliationRetryUnderGate(state);
            return;
        }

        var previousConfiguration = state.LastConfiguration ?? configuration;
        var previousRecipients = state.LastRecipients ?? [];
        await ReconcileResolvedPresenceAsync(
            state,
            scope.ServiceProvider,
            db,
            user,
            previousConfiguration,
            previousRecipients,
            configuration,
            currentRecipients,
            forceOnlineAnnouncement: !state.IsAnnouncedOnline &&
                configuration.Mode == PresenceModeCodes.Automatic,
            forceOffline: false,
            cancellationToken);
    }

    private async Task HandleSettingsChangedAsync(
        Guid userId,
        UserPresenceState state,
        UserPresenceConfiguration previousHint,
        CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await GetActiveUserAsync(db, userId, cancellationToken);
        if (user == null)
        {
            state.IsAnnouncedOnline = false;
            ResetReconciliationRetryUnderGate(state);
            return;
        }

        var current = GetConfiguration(user);
        if (current.Mode == PresenceModeCodes.Invisible)
        {
            CancelPendingDisconnect(state);
        }

        var audience = await ResolveAudienceAsync(
            scope.ServiceProvider,
            userId,
            cancellationToken);
        var previous = state.LastConfiguration ?? previousHint;
        var previousRecipients = state.LastRecipients ?? audience
            .GetRecipients(previous.Visibility)
            .ToHashSet();
        var currentRecipients = audience
            .GetRecipients(current.Visibility)
            .ToHashSet();

        await ReconcileResolvedPresenceAsync(
            state,
            scope.ServiceProvider,
            db,
            user,
            previous,
            previousRecipients,
            current,
            currentRecipients,
            forceOnlineAnnouncement: false,
            forceOffline: false,
            cancellationToken);
    }

    private async Task HandleAudienceChangedAsync(
        UserPresenceState state,
        CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await GetActiveUserAsync(
            db,
            state.UserId,
            cancellationToken);
        if (user == null)
        {
            state.IsAnnouncedOnline = false;
            ResetReconciliationRetryUnderGate(state);
            return;
        }

        var current = GetConfiguration(user);
        var audience = await ResolveAudienceAsync(
            scope.ServiceProvider,
            user.Id,
            cancellationToken);
        var currentRecipients = audience
            .GetRecipients(current.Visibility)
            .ToHashSet();
        if (state.LastRecipients == null)
        {
            SetLastSnapshot(state, current, currentRecipients);
            ResetReconciliationRetryUnderGate(state);
            return;
        }

        await ReconcileResolvedPresenceAsync(
            state,
            scope.ServiceProvider,
            db,
            user,
            state.LastConfiguration ?? current,
            state.LastRecipients,
            current,
            currentRecipients,
            forceOnlineAnnouncement: false,
            forceOffline: false,
            cancellationToken);
    }

    private async Task CompleteDisconnectAfterGraceAsync(
        Guid userId,
        UserPresenceState state,
        CancellationTokenSource pendingDisconnect)
    {
        try
        {
            await Task.Delay(
                _disconnectGrace,
                _timeProvider,
                pendingDisconnect.Token);
            await using var mutationLease = await EnterMutationGatesAsync(
                [userId],
                CancellationToken.None);
            await state.Gate.WaitAsync(CancellationToken.None);
            try
            {
                if (!ReferenceEquals(
                        state.PendingDisconnect,
                        pendingDisconnect) ||
                    pendingDisconnect.IsCancellationRequested)
                {
                    return;
                }

                state.PendingDisconnect = null;
                if (_connections.HasConnections(userId) ||
                    !state.IsAnnouncedOnline)
                {
                    return;
                }

                await HandleOfflineReconciliationAsync(
                    state,
                    CancellationToken.None);
            }
            finally
            {
                state.Gate.Release();
            }
        }
        catch (OperationCanceledException) when (pendingDisconnect.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Presence disconnect grace completion failed. UserId={UserId}",
                userId);
            await ScheduleReconciliationRetryAsync(state);
        }
        finally
        {
            await state.Gate.WaitAsync(CancellationToken.None);
            try
            {
                if (ReferenceEquals(
                        state.PendingDisconnect,
                        pendingDisconnect))
                {
                    state.PendingDisconnect = null;
                }
            }
            finally
            {
                state.Gate.Release();
            }

            pendingDisconnect.Dispose();
        }
    }

    private async Task HandleOfflineReconciliationAsync(
        UserPresenceState state,
        CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await GetActiveUserAsync(
            db,
            state.UserId,
            cancellationToken);
        if (user == null)
        {
            state.IsAnnouncedOnline = false;
            ResetReconciliationRetryUnderGate(state);
            return;
        }

        var configuration = GetConfiguration(user);
        var audience = await ResolveAudienceAsync(
            scope.ServiceProvider,
            user.Id,
            cancellationToken);
        var currentRecipients = audience
            .GetRecipients(configuration.Visibility)
            .ToHashSet();
        await ReconcileResolvedPresenceAsync(
            state,
            scope.ServiceProvider,
            db,
            user,
            state.LastConfiguration ?? configuration,
            state.LastRecipients ?? currentRecipients,
            configuration,
            currentRecipients,
            forceOnlineAnnouncement: false,
            forceOffline: true,
            cancellationToken);
    }

    private async Task ReconcileResolvedPresenceAsync(
        UserPresenceState state,
        IServiceProvider services,
        AppDbContext db,
        User user,
        UserPresenceConfiguration previousConfiguration,
        IReadOnlySet<Guid> previousRecipients,
        UserPresenceConfiguration currentConfiguration,
        IReadOnlySet<Guid> currentRecipients,
        bool forceOnlineAnnouncement,
        bool forceOffline,
        CancellationToken cancellationToken)
    {
        var hasConnections = _connections.HasConnections(user.Id);
        var wasOnline = state.IsAnnouncedOnline;
        var becameInvisible =
            previousConfiguration.Mode == PresenceModeCodes.Automatic &&
            currentConfiguration.Mode == PresenceModeCodes.Invisible &&
            wasOnline;
        var becameAutomaticallyVisible =
            previousConfiguration.Mode == PresenceModeCodes.Invisible &&
            currentConfiguration.Mode == PresenceModeCodes.Automatic &&
            hasConnections;
        var shouldRecordLastSeen =
            becameInvisible ||
            becameAutomaticallyVisible ||
            (forceOnlineAnnouncement && hasConnections) ||
            (forceOffline &&
             wasOnline &&
             currentConfiguration.Mode == PresenceModeCodes.Automatic);
        var isOnline =
            !forceOffline &&
            currentConfiguration.Mode == PresenceModeCodes.Automatic &&
            (hasConnections || wasOnline || forceOnlineAnnouncement);
        var configurationChanged = previousConfiguration != currentConfiguration;
        var removedRecipients = previousRecipients
            .Except(currentRecipients)
            .ToArray();
        var addedRecipients = currentRecipients
            .Except(previousRecipients)
            .ToArray();
        var statusChanged = wasOnline != isOnline;

        if (!configurationChanged &&
            removedRecipients.Length == 0 &&
            addedRecipients.Length == 0 &&
            !statusChanged &&
            !forceOnlineAnnouncement)
        {
            SetLastSnapshot(state, currentConfiguration, currentRecipients);
            ResetReconciliationRetryUnderGate(state);
            return;
        }

        var changedAt = GetNextChangedAt(state, user.LastSeenAt);
        if (shouldRecordLastSeen)
        {
            user.LastSeenAt = changedAt;
            await db.SaveChangesAsync(cancellationToken);
        }

        var cleanupPublished = await PublishAsync(
            services,
            removedRecipients,
            new UserPresenceChanged(
                user.Id,
                PresenceStatusCodes.Offline,
                LastSeenAt: null,
                changedAt),
            cancellationToken);

        IEnumerable<Guid> recipientsToPublish = configurationChanged ||
                                                statusChanged ||
                                                forceOnlineAnnouncement
            ? currentRecipients
            : addedRecipients;
        var currentPublished = await PublishAsync(
            services,
            recipientsToPublish,
            new UserPresenceChanged(
                user.Id,
                isOnline
                    ? PresenceStatusCodes.Online
                    : PresenceStatusCodes.Offline,
                currentConfiguration.ShowLastSeen
                    ? user.LastSeenAt
                    : null,
                changedAt),
            cancellationToken);

        var publishedRecipients = previousRecipients.ToHashSet();
        if (cleanupPublished)
        {
            publishedRecipients.ExceptWith(removedRecipients);
        }
        if (currentPublished)
        {
            publishedRecipients.UnionWith(recipientsToPublish);
            state.LastConfiguration = currentConfiguration;
            state.IsAnnouncedOnline = isOnline;
        }

        state.LastRecipients = publishedRecipients;
        if (cleanupPublished && currentPublished)
        {
            ResetReconciliationRetryUnderGate(state);
        }
        else
        {
            ScheduleReconciliationRetryUnderGate(state);
        }
    }

    private async Task<bool> PublishAsync(
        IServiceProvider services,
        IEnumerable<Guid> recipientUserIds,
        UserPresenceChanged payload,
        CancellationToken cancellationToken)
    {
        var recipients = recipientUserIds.Distinct().ToArray();
        if (recipients.Length == 0)
        {
            return true;
        }

        var realtime = services
            .GetRequiredService<IRealtimeNotificationService>();
        for (var attempt = 1; attempt <= MaxPublishAttempts; attempt++)
        {
            try
            {
                await realtime.NotifyUsersAsync(
                    recipients,
                    RealtimeEventNames.UserPresenceChanged,
                    payload,
                    cancellationToken);
                return true;
            }
            catch (OperationCanceledException) when (
                cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception) when (attempt < MaxPublishAttempts)
            {
                _logger.LogDebug(
                    exception,
                    "Presence notification failed and will be retried. UserId={UserId} Attempt={Attempt}",
                    payload.UserId,
                    attempt);
            }
            catch (Exception exception)
            {
                _logger.LogWarning(
                    exception,
                    "Presence notification failed after bounded retries. UserId={UserId} Attempts={Attempts}",
                    payload.UserId,
                    MaxPublishAttempts);
            }
        }

        return false;
    }

    private async Task ExecuteSerializedBestEffortAsync(
        Guid userId,
        Func<UserPresenceState, CancellationToken, Task> action,
        CancellationToken cancellationToken)
    {
        var state = _states.GetOrAdd(
            userId,
            static id => new UserPresenceState(id));

        await ExecuteSerializedBestEffortAsync(
            state,
            action,
            cancellationToken);
    }

    private async Task ExecuteSerializedBestEffortAsync(
        UserPresenceState state,
        Func<UserPresenceState, CancellationToken, Task> action,
        CancellationToken cancellationToken)
    {

        try
        {
            await using var mutationLease = await EnterMutationGatesAsync(
                [state.UserId],
                cancellationToken);
            await state.Gate.WaitAsync(cancellationToken);
            try
            {
                await action(state, cancellationToken);
            }
            finally
            {
                state.Gate.Release();
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            _logger.LogDebug(
                "Presence transition canceled. UserId={UserId}",
                state.UserId);
            await ScheduleReconciliationRetryAsync(state);
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Presence transition failed. UserId={UserId}",
                state.UserId);
            await ScheduleReconciliationRetryAsync(state);
        }
    }

    private async Task ScheduleReconciliationRetryAsync(
        UserPresenceState state)
    {
        await state.Gate.WaitAsync(CancellationToken.None);
        try
        {
            ScheduleReconciliationRetryUnderGate(state);
        }
        finally
        {
            state.Gate.Release();
        }
    }

    private void ScheduleReconciliationRetryUnderGate(
        UserPresenceState state)
    {
        if (state.PendingReconciliation != null)
        {
            return;
        }

        if (state.ReconciliationRetryAttempt >=
            ReconciliationRetryDelays.Length)
        {
            _logger.LogWarning(
                "Presence reconciliation exhausted bounded background retries. UserId={UserId} Attempts={Attempts}",
                state.UserId,
                ReconciliationRetryDelays.Length);
            return;
        }

        var attempt = ++state.ReconciliationRetryAttempt;
        var pendingReconciliation = new CancellationTokenSource();
        state.PendingReconciliation = pendingReconciliation;
        _ = CompleteReconciliationRetryAsync(
            state,
            pendingReconciliation,
            attempt);
    }

    private async Task CompleteReconciliationRetryAsync(
        UserPresenceState state,
        CancellationTokenSource pendingReconciliation,
        int attempt)
    {
        try
        {
            await Task.Delay(
                ReconciliationRetryDelays[attempt - 1],
                _timeProvider,
                pendingReconciliation.Token);

            await state.Gate.WaitAsync(CancellationToken.None);
            try
            {
                if (!ReferenceEquals(
                        state.PendingReconciliation,
                        pendingReconciliation) ||
                    pendingReconciliation.IsCancellationRequested)
                {
                    return;
                }

                state.PendingReconciliation = null;
            }
            finally
            {
                state.Gate.Release();
            }

            await ExecuteSerializedBestEffortAsync(
                state,
                HandleReconciliationRetryAsync,
                CancellationToken.None);
        }
        catch (OperationCanceledException) when (
            pendingReconciliation.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            _logger.LogWarning(
                exception,
                "Presence background reconciliation failed. UserId={UserId} Attempt={Attempt}",
                state.UserId,
                attempt);
            await ScheduleReconciliationRetryAsync(state);
        }
        finally
        {
            pendingReconciliation.Dispose();
        }
    }

    private Task HandleReconciliationRetryAsync(
        UserPresenceState state,
        CancellationToken cancellationToken)
    {
        if (_connections.HasConnections(state.UserId))
        {
            return HandleFirstConnectionAsync(state, cancellationToken);
        }

        if (state.IsAnnouncedOnline && state.PendingDisconnect == null)
        {
            return HandleOfflineReconciliationAsync(
                state,
                cancellationToken);
        }

        return HandleAudienceChangedAsync(state, cancellationToken);
    }

    private static void ResetReconciliationRetryUnderGate(
        UserPresenceState state)
    {
        state.ReconciliationRetryAttempt = 0;
        var pendingReconciliation = state.PendingReconciliation;
        state.PendingReconciliation = null;
        pendingReconciliation?.Cancel();
    }

    private async ValueTask<MutationGateLease> EnterMutationGatesAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken)
    {
        var gates = userIds
            .Where(userId => userId != Guid.Empty)
            .Distinct()
            .Order()
            .Select(userId => _mutationGates.GetOrAdd(
                userId,
                static _ => new SemaphoreSlim(1, 1)))
            .ToArray();
        var acquiredCount = 0;

        try
        {
            foreach (var gate in gates)
            {
                await gate.WaitAsync(cancellationToken);
                acquiredCount++;
            }

            return new MutationGateLease(gates);
        }
        catch
        {
            for (var index = acquiredCount - 1; index >= 0; index--)
            {
                gates[index].Release();
            }

            throw;
        }
    }

    private static Task<UserPresenceAudienceSnapshot> ResolveAudienceAsync(
        IServiceProvider services,
        Guid userId,
        CancellationToken cancellationToken)
    {
        return services
            .GetRequiredService<IUserPresenceAudienceService>()
            .ResolveAsync(userId, cancellationToken);
    }

    private static async Task<User?> GetActiveUserAsync(
        AppDbContext db,
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await db.Users
            .Include(user => user.ProfileSettings)
            .FirstOrDefaultAsync(
                user =>
                    user.Id == userId &&
                    user.DeletedAt == null &&
                    user.StatusId == UserStatusIds.Active,
                cancellationToken);
    }

    private static UserPresenceConfiguration GetConfiguration(User user)
    {
        return user.ProfileSettings == null
            ? new UserPresenceConfiguration(
                PresenceVisibilityCodes.Everyone,
                ShowLastSeen: true,
                PresenceModeCodes.Automatic)
            : UserPresenceConfiguration.Create(
                user.ProfileSettings.PresenceVisibility,
                user.ProfileSettings.ShowLastSeen,
                user.ProfileSettings.PresenceMode);
    }

    private static void CancelPendingDisconnect(UserPresenceState state)
    {
        var pendingDisconnect = state.PendingDisconnect;
        state.PendingDisconnect = null;
        pendingDisconnect?.Cancel();
    }

    private static void SetLastSnapshot(
        UserPresenceState state,
        UserPresenceConfiguration configuration,
        IEnumerable<Guid> recipients)
    {
        state.LastConfiguration = configuration;
        state.LastRecipients = recipients.ToHashSet();
    }

    private DateTime GetNextChangedAt(
        UserPresenceState state,
        DateTime? persistedLastSeenAt)
    {
        if (persistedLastSeenAt is { } persistedValue &&
            persistedValue > state.LastChangedAt)
        {
            state.LastChangedAt = persistedValue;
        }

        var now = _timeProvider.GetUtcNow().UtcDateTime;
        if (now <= state.LastChangedAt)
        {
            now = state.LastChangedAt.AddTicks(1);
        }

        state.LastChangedAt = now;
        return now;
    }

    private sealed class UserPresenceState(Guid userId)
    {
        public Guid UserId { get; } = userId;
        public SemaphoreSlim Gate { get; } = new(1, 1);
        public CancellationTokenSource? PendingDisconnect { get; set; }
        public bool IsAnnouncedOnline { get; set; }
        public DateTime LastChangedAt { get; set; }
        public UserPresenceConfiguration? LastConfiguration { get; set; }
        public HashSet<Guid>? LastRecipients { get; set; }
        public CancellationTokenSource? PendingReconciliation { get; set; }
        public int ReconciliationRetryAttempt { get; set; }
    }

    private sealed class MutationGateLease(
        IReadOnlyList<SemaphoreSlim> gates) : IAsyncDisposable
    {
        public ValueTask DisposeAsync()
        {
            for (var index = gates.Count - 1; index >= 0; index--)
            {
                gates[index].Release();
            }

            return ValueTask.CompletedTask;
        }
    }
}
