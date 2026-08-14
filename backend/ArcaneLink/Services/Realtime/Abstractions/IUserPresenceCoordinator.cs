namespace ArcaneLink.Services.Realtime.Abstractions;

public interface IUserPresenceCoordinator
{
    Task ConnectionRegisteredAsync(
        RealtimeConnectionRegistrationResult registration,
        CancellationToken cancellationToken = default);

    Task ConnectionUnregisteredAsync(
        RealtimeConnectionUnregistrationResult unregistration,
        CancellationToken cancellationToken = default);

    Task SettingsChangedAsync(
        Guid userId,
        UserPresenceConfiguration previous,
        UserPresenceConfiguration current,
        CancellationToken cancellationToken = default);

    Task AudienceChangedAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken = default);

    Task ExecuteMutationAsync(
        IEnumerable<Guid> userIds,
        Func<CancellationToken, Task> mutation,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> ExecuteTopologyMutationAsync(
        UserPresenceTopologyKey topologyKey,
        IEnumerable<Guid> explicitUserIds,
        Func<CancellationToken, Task<IReadOnlyCollection<Guid>>> resolveActiveUserIds,
        Func<CancellationToken, Task> mutation,
        CancellationToken cancellationToken = default);
}
