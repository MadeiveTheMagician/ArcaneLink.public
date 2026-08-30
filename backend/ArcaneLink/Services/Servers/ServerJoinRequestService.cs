using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Servers.ServerResponseMapper;

namespace ArcaneLink.Services.Servers;

public class ServerJoinRequestService : IServerJoinRequestService
{
    private readonly AppDbContext _db;
    private readonly IServerGovernanceAccessService _access;
    private readonly ServerPermissionRealtimeAudienceService _permissionAudience;
    private readonly IRealtimeNotificationService _realtime;
    private readonly RealtimeServerGroupMembershipService _serverGroups;
    private readonly ISpaceAuthorizationService _spaceAuthorization;
    private readonly ServerVoiceAccessReconciliationService _voiceAccess;
    private readonly IUserPresenceCoordinator _presenceCoordinator;
    private readonly IUserNotificationService _notifications;
    private readonly ILogger<ServerJoinRequestService> _logger;

    public ServerJoinRequestService(
        AppDbContext db,
        IServerGovernanceAccessService access,
        ServerPermissionRealtimeAudienceService permissionAudience,
        IRealtimeNotificationService realtime,
        RealtimeServerGroupMembershipService serverGroups,
        ISpaceAuthorizationService spaceAuthorization,
        ServerVoiceAccessReconciliationService voiceAccess,
        IUserPresenceCoordinator presenceCoordinator,
        IUserNotificationService notifications,
        ILogger<ServerJoinRequestService> logger)
    {
        this._db = db;
        this._access = access;
        this._permissionAudience = permissionAudience;
        this._realtime = realtime;
        this._serverGroups = serverGroups;
        this._spaceAuthorization = spaceAuthorization;
        this._voiceAccess = voiceAccess;
        this._presenceCoordinator = presenceCoordinator;
        this._notifications = notifications;
        this._logger = logger;
    }

    public async Task<ServerJoinResponse?> JoinAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default)
    {
        var server = await this._db.Servers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                candidate =>
                    candidate.Id == serverId &&
                    candidate.DeletedAt == null &&
                    !candidate.IsSystem,
                cancellationToken);
        if (server == null)
        {
            return null;
        }

        var existingMembership = await this._db.ServerMembers
            .AsNoTracking()
            .Include(member => member.Status)
            .Include(member => member.Server)
            .FirstOrDefaultAsync(
                member =>
                    member.ServerId == serverId &&
                    member.UserId == currentUserId,
                cancellationToken);
        if (existingMembership?.StatusId == ServerMemberStatusIds.Banned ||
            existingMembership?.BannedAt != null)
        {
            return null;
        }

        if (existingMembership?.StatusId == ServerMemberStatusIds.Active)
        {
            return new ServerJoinResponse
            {
                Status = ServerJoinResultStatusCodes.Joined,
                Membership = ToServerMemberResponse(existingMembership)
            };
        }

        if (server.AccessMode == ServerAccessModeCodes.Private)
        {
            return null;
        }

        if (server.AccessMode == ServerAccessModeCodes.Restricted)
        {
            return await this.CreatePendingRequestAsync(
                currentUserId,
                serverId,
                cancellationToken);
        }

        if (server.AccessMode != ServerAccessModeCodes.Public)
        {
            return null;
        }

        var membership = await this.ActivateMembershipAsync(
            currentUserId,
            serverId,
            cancellationToken);
        return membership == null
            ? null
            : new ServerJoinResponse
            {
                Status = ServerJoinResultStatusCodes.Joined,
                Membership = membership
            };
    }

    public async Task<ServerJoinRequestPageResponse?> GetPendingAsync(
        Guid currentUserId,
        Guid serverId,
        DateTime? afterCreatedAt,
        Guid? afterId,
        int limit,
        CancellationToken cancellationToken = default)
    {
        if (!await this._access.HasGranularPermissionAsync(
                currentUserId,
                serverId,
                "APPROVE_JOIN_REQUESTS",
                cancellationToken))
        {
            return null;
        }

        var pendingRequests = this._db.ServerJoinRequests
            .AsNoTracking()
            .Where(joinRequest =>
                joinRequest.ServerId == serverId &&
                joinRequest.StatusCode ==
                ServerJoinRequestStatusCodes.Pending);
        var totalCount = await pendingRequests.CountAsync(cancellationToken);
        var query = pendingRequests
            .Include(joinRequest => joinRequest.User)
                .ThenInclude(user => user.Profile)
            .AsQueryable();

        if (afterCreatedAt.HasValue && afterId.HasValue)
        {
            var cursorTime = NormalizeUtc(afterCreatedAt.Value);
            var cursorId = afterId.Value;
            query = query.Where(joinRequest =>
                joinRequest.CreatedAt < cursorTime ||
                joinRequest.CreatedAt == cursorTime &&
                joinRequest.Id.CompareTo(cursorId) < 0);
        }

        var pageSize = Math.Clamp(limit, 1, 100);
        var requests = await query
            .OrderByDescending(joinRequest => joinRequest.CreatedAt)
            .ThenByDescending(joinRequest => joinRequest.Id)
            .Take(pageSize + 1)
            .ToListAsync(cancellationToken);
        var hasMore = requests.Count > pageSize;
        if (hasMore)
        {
            requests.RemoveAt(requests.Count - 1);
        }

        return new ServerJoinRequestPageResponse
        {
            Items = requests.Select(ToResponse).ToList(),
            NextCursor = hasMore && requests.Count > 0
                ? new ServerJoinRequestCursorResponse
                {
                    CreatedAt = NormalizeUtc(requests[^1].CreatedAt),
                    Id = requests[^1].Id
                }
                : null,
            TotalCount = totalCount
        };
    }

    public async Task<ServerMemberResponse?> ApproveAsync(
        Guid currentUserId,
        Guid serverId,
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        if (!await this._access.HasGranularPermissionAsync(
                currentUserId,
                serverId,
                "APPROVE_JOIN_REQUESTS",
                cancellationToken))
        {
            return null;
        }

        var joinRequest = await this._db.ServerJoinRequests
            .Include(request => request.Server)
            .AsNoTracking()
            .FirstOrDefaultAsync(
                request =>
                    request.Id == requestId &&
                    request.ServerId == serverId &&
                    request.StatusCode ==
                    ServerJoinRequestStatusCodes.Pending,
                cancellationToken);
        if (joinRequest == null ||
            joinRequest.Server.DeletedAt != null ||
            joinRequest.Server.AccessMode !=
            ServerAccessModeCodes.Restricted)
        {
            return null;
        }

        ServerMember? membership = null;
        var mutationSucceeded = false;
        var presenceSubjects = await this._presenceCoordinator
            .ExecuteTopologyMutationAsync(
                UserPresenceTopologyKey.Server(serverId),
                [joinRequest.UserId],
                token => this.ResolveActiveServerUserIdsAsync(serverId, token),
                async token =>
                {
                    await using var transaction = await this._db.Database
                        .BeginTransactionAsync(token);
                    await this._db.Entry(joinRequest).ReloadAsync(token);
                    await this._db.Entry(joinRequest.Server).ReloadAsync(token);
                    if (joinRequest.StatusCode !=
                            ServerJoinRequestStatusCodes.Pending ||
                        joinRequest.Server.DeletedAt != null ||
                        joinRequest.Server.AccessMode !=
                            ServerAccessModeCodes.Restricted)
                    {
                        return;
                    }

                    var now = DateTime.UtcNow;
                    var claimedRequests = await this._db.ServerJoinRequests
                        .Where(request =>
                            request.Id == requestId &&
                            request.ServerId == serverId &&
                            request.StatusCode ==
                                ServerJoinRequestStatusCodes.Pending)
                        .ExecuteUpdateAsync(
                            setters => setters
                                .SetProperty(
                                    request => request.StatusCode,
                                    ServerJoinRequestStatusCodes.Approved)
                                .SetProperty(
                                    request => request.ReviewedAt,
                                    (DateTime?)now)
                                .SetProperty(
                                    request =>
                                        request.ReviewedByUserId,
                                    (Guid?)currentUserId)
                                .SetProperty(
                                    request => request.UpdatedAt,
                                    now),
                            token);
                    if (claimedRequests != 1)
                    {
                        return;
                    }

                    membership = await this._db.ServerMembers
                        .FirstOrDefaultAsync(
                            member =>
                                member.ServerId == serverId &&
                                member.UserId == joinRequest.UserId,
                            token);
                    if (membership?.StatusId ==
                            ServerMemberStatusIds.Banned ||
                        membership?.BannedAt != null)
                    {
                        return;
                    }

                    if (membership == null)
                    {
                        membership = new ServerMember
                        {
                            Id = Guid.NewGuid(),
                            ServerId = serverId,
                            UserId = joinRequest.UserId,
                            StatusId = ServerMemberStatusIds.Active,
                            JoinedAt = now,
                            AddedByUserId = currentUserId,
                            CreatedAt = now,
                            UpdatedAt = now
                        };
                        this._db.ServerMembers.Add(membership);
                    }
                    else
                    {
                        ReactivateMembership(membership, now);
                    }

                    this._access.AddAudit(
                        serverId,
                        ServerGovernanceIds.AuditMemberJoined,
                        currentUserId,
                        joinRequest.UserId);
                    await this._db.StageServerAclRevisionBumpAsync(
                        serverId,
                        token);
                    await this._db.SaveChangesAsync(token);
                    await transaction.CommitAsync(token);
                    mutationSucceeded = true;
                },
                cancellationToken);
        if (!mutationSucceeded || membership == null)
        {
            return null;
        }

        await this.FinalizeMembershipAddedAsync(
            serverId,
            joinRequest.UserId,
            requestId,
            presenceSubjects);
        await this._notifications.CreateSystemAsync(
            joinRequest.UserId,
            "Заявка на вступление одобрена",
            $"Вы приняты на сервер «{joinRequest.Server.Title}».",
            cancellationToken: CancellationToken.None);
        await this.LoadMembershipReferencesAsync(membership, cancellationToken);
        return ToServerMemberResponse(membership);
    }

    public async Task<bool> DeclineAsync(
        Guid currentUserId,
        Guid serverId,
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        if (!await this._access.HasGranularPermissionAsync(
                currentUserId,
                serverId,
                "APPROVE_JOIN_REQUESTS",
                cancellationToken))
        {
            return false;
        }

        var joinRequest = await this._db.ServerJoinRequests
            .Include(request => request.Server)
            .FirstOrDefaultAsync(
                request =>
                    request.Id == requestId &&
                    request.ServerId == serverId &&
                    request.StatusCode ==
                    ServerJoinRequestStatusCodes.Pending &&
                    request.Server.DeletedAt == null &&
                    request.Server.AccessMode ==
                        ServerAccessModeCodes.Restricted,
                cancellationToken);
        if (joinRequest == null)
        {
            return false;
        }

        var now = DateTime.UtcNow;
        var declinedRequests = await this._db.ServerJoinRequests
            .Where(request =>
                request.Id == requestId &&
                request.ServerId == serverId &&
                request.StatusCode ==
                    ServerJoinRequestStatusCodes.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        request => request.StatusCode,
                        ServerJoinRequestStatusCodes.Declined)
                    .SetProperty(
                        request => request.ReviewedAt,
                        (DateTime?)now)
                    .SetProperty(
                        request => request.ReviewedByUserId,
                        (Guid?)currentUserId)
                    .SetProperty(
                        request => request.UpdatedAt,
                        now),
                cancellationToken);
        if (declinedRequests != 1)
        {
            return false;
        }

        await this.NotifyRequestChangedAsync(
            serverId,
            joinRequest.UserId,
            joinRequest.Id);
        await this._notifications.CreateSystemAsync(
            joinRequest.UserId,
            "Заявка на вступление отклонена",
            $"Заявка на сервер «{joinRequest.Server.Title}» отклонена.",
            cancellationToken: CancellationToken.None);
        return true;
    }

    public async Task<bool> CancelAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken = default)
    {
        var joinRequest = await this._db.ServerJoinRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(
                request =>
                    request.ServerId == serverId &&
                    request.UserId == currentUserId &&
                    request.StatusCode ==
                    ServerJoinRequestStatusCodes.Pending &&
                    request.Server.DeletedAt == null,
                cancellationToken);
        if (joinRequest == null)
        {
            return false;
        }

        var now = DateTime.UtcNow;
        var cancelledRequests = await this._db.ServerJoinRequests
            .Where(request =>
                request.Id == joinRequest.Id &&
                request.StatusCode ==
                    ServerJoinRequestStatusCodes.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        request => request.StatusCode,
                        ServerJoinRequestStatusCodes.Cancelled)
                    .SetProperty(
                        request => request.ReviewedAt,
                        (DateTime?)now)
                    .SetProperty(
                        request => request.ReviewedByUserId,
                        (Guid?)null)
                    .SetProperty(
                        request => request.UpdatedAt,
                        now),
                cancellationToken);
        if (cancelledRequests != 1)
        {
            return false;
        }

        await this.NotifyRequestChangedAsync(
            serverId,
            currentUserId,
            joinRequest.Id);
        return true;
    }

    private async Task<ServerJoinResponse?> CreatePendingRequestAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken)
    {
        var existing = await this._db.ServerJoinRequests
            .AsNoTracking()
            .Include(request => request.User)
                .ThenInclude(user => user.Profile)
            .Where(request =>
                request.ServerId == serverId &&
                request.UserId == currentUserId &&
                request.StatusCode ==
                ServerJoinRequestStatusCodes.Pending)
            .OrderByDescending(request => request.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing != null)
        {
            return new ServerJoinResponse
            {
                Status = ServerJoinResultStatusCodes.Pending,
                JoinRequest = ToResponse(existing)
            };
        }

        var user = await this._db.Users
            .Include(candidate => candidate.Profile)
            .FirstOrDefaultAsync(
                candidate =>
                    candidate.Id == currentUserId &&
                    candidate.DeletedAt == null &&
                    candidate.StatusId == UserStatusIds.Active,
                cancellationToken);
        if (user == null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var joinRequest = new ServerJoinRequest
        {
            Id = Guid.NewGuid(),
            ServerId = serverId,
            UserId = currentUserId,
            User = user,
            StatusCode = ServerJoinRequestStatusCodes.Pending,
            CreatedAt = now,
            UpdatedAt = now
        };
        this._db.ServerJoinRequests.Add(joinRequest);
        try
        {
            await this._db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            this._db.Entry(joinRequest).State = EntityState.Detached;
            existing = await this._db.ServerJoinRequests
                .AsNoTracking()
                .Include(request => request.User)
                    .ThenInclude(candidate => candidate.Profile)
                .Where(request =>
                    request.ServerId == serverId &&
                    request.UserId == currentUserId &&
                    request.StatusCode ==
                        ServerJoinRequestStatusCodes.Pending)
                .OrderByDescending(request => request.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
            if (existing == null)
            {
                throw;
            }

            return new ServerJoinResponse
            {
                Status = ServerJoinResultStatusCodes.Pending,
                JoinRequest = ToResponse(existing)
            };
        }
        await this.NotifyRequestChangedAsync(
            serverId,
            currentUserId,
            joinRequest.Id);

        return new ServerJoinResponse
        {
            Status = ServerJoinResultStatusCodes.Pending,
            JoinRequest = ToResponse(joinRequest)
        };
    }

    private async Task<ServerMemberResponse?> ActivateMembershipAsync(
        Guid currentUserId,
        Guid serverId,
        CancellationToken cancellationToken)
    {
        ServerMember? membership = null;
        var mutationSucceeded = false;
        var presenceSubjects = await this._presenceCoordinator
            .ExecuteTopologyMutationAsync(
                UserPresenceTopologyKey.Server(serverId),
                [currentUserId],
                token => this.ResolveActiveServerUserIdsAsync(serverId, token),
                async token =>
                {
                    await using var transaction = await this._db.Database
                        .BeginTransactionAsync(token);
                    var server = await this._db.Servers
                        .FirstOrDefaultAsync(
                            candidate =>
                                candidate.Id == serverId &&
                                candidate.DeletedAt == null &&
                                !candidate.IsSystem,
                            token);
                    if (server?.AccessMode != ServerAccessModeCodes.Public)
                    {
                        return;
                    }

                    membership = await this._db.ServerMembers
                        .FirstOrDefaultAsync(
                            member =>
                                member.ServerId == serverId &&
                                member.UserId == currentUserId,
                            token);
                    if (membership?.StatusId ==
                            ServerMemberStatusIds.Banned ||
                        membership?.BannedAt != null)
                    {
                        return;
                    }

                    var wasActive = membership?.StatusId ==
                        ServerMemberStatusIds.Active;
                    var now = DateTime.UtcNow;
                    if (membership == null)
                    {
                        membership = new ServerMember
                        {
                            Id = Guid.NewGuid(),
                            ServerId = serverId,
                            UserId = currentUserId,
                            StatusId = ServerMemberStatusIds.Active,
                            JoinedAt = now,
                            AddedByUserId = null,
                            CreatedAt = now,
                            UpdatedAt = now
                        };
                        this._db.ServerMembers.Add(membership);
                    }
                    else if (!wasActive)
                    {
                        ReactivateMembership(membership, now);
                    }

                    await this._db.ServerJoinRequests
                        .Where(request =>
                            request.ServerId == serverId &&
                            request.UserId == currentUserId &&
                            request.StatusCode ==
                                ServerJoinRequestStatusCodes.Pending)
                        .ExecuteUpdateAsync(
                            setters => setters
                                .SetProperty(
                                    request => request.StatusCode,
                                    ServerJoinRequestStatusCodes.Approved)
                                .SetProperty(
                                    request => request.ReviewedAt,
                                    now)
                                .SetProperty(
                                    request => request.ReviewedByUserId,
                                    (Guid?)null)
                                .SetProperty(
                                    request => request.UpdatedAt,
                                    now),
                            token);
                    if (!wasActive)
                    {
                        this._access.AddAudit(
                            serverId,
                            ServerGovernanceIds.AuditMemberJoined,
                            currentUserId,
                            currentUserId);
                        await this._db.StageServerAclRevisionBumpAsync(
                            serverId,
                            token);
                    }

                    await this._db.SaveChangesAsync(token);
                    await transaction.CommitAsync(token);
                    mutationSucceeded = true;
                },
                cancellationToken);
        if (!mutationSucceeded || membership == null)
        {
            return null;
        }

        await this.FinalizeMembershipAddedAsync(
            serverId,
            currentUserId,
            requestId: null,
            presenceSubjects);
        await this.LoadMembershipReferencesAsync(membership, cancellationToken);
        return ToServerMemberResponse(membership);
    }

    private async Task FinalizeMembershipAddedAsync(
        Guid serverId,
        Guid userId,
        Guid? requestId,
        IReadOnlyCollection<Guid> presenceSubjects)
    {
        await this._presenceCoordinator.AudienceChangedAsync(
            presenceSubjects,
            CancellationToken.None);
        await this._serverGroups.AddUserBestEffortAsync(userId, serverId);
        this._spaceAuthorization.InvalidateServer(serverId);
        await this._voiceAccess.ReconcileServerBestEffortAsync(serverId);
        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            userId,
            RealtimeEventNames.UserServersChanged,
            new { serverId, requestId },
            CancellationToken.None);
        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            userId,
            RealtimeEventNames.ServerJoinRequestChanged,
            new { serverId, requestId },
            CancellationToken.None);
        await this._realtime.NotifyServerBestEffortAsync(
            this._logger,
            serverId,
            RealtimeEventNames.ServerMembersChanged,
            new { serverId, userId },
            CancellationToken.None);
        await this.NotifyJoinRequestReviewersAsync(
            serverId,
            requestId,
            CancellationToken.None);
    }

    private async Task NotifyRequestChangedAsync(
        Guid serverId,
        Guid userId,
        Guid requestId)
    {
        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            userId,
            RealtimeEventNames.ServerJoinRequestChanged,
            new { serverId, requestId },
            CancellationToken.None);
        await this.NotifyJoinRequestReviewersAsync(
            serverId,
            requestId,
            CancellationToken.None);
    }

    private async Task NotifyJoinRequestReviewersAsync(
        Guid serverId,
        Guid? requestId,
        CancellationToken cancellationToken)
    {
        var audience = await this._permissionAudience.ResolveAsync(
            serverId,
            ["APPROVE_JOIN_REQUESTS"],
            cancellationToken: cancellationToken);
        await this._realtime.NotifyUsersBestEffortAsync(
            this._logger,
            audience,
            RealtimeEventNames.ServerJoinRequestsChanged,
            new { serverId, requestId },
            cancellationToken);
        await this._realtime.NotifyUsersBestEffortAsync(
            this._logger,
            audience,
            RealtimeEventNames.ServerGovernanceChanged,
            new { serverId, requestId },
            cancellationToken);
    }

    private async Task LoadMembershipReferencesAsync(
        ServerMember membership,
        CancellationToken cancellationToken)
    {
        if (!this._db.Entry(membership).Reference(member => member.Status).IsLoaded)
        {
            await this._db.Entry(membership)
                .Reference(member => member.Status)
                .LoadAsync(cancellationToken);
        }
        if (!this._db.Entry(membership).Reference(member => member.Server).IsLoaded)
        {
            await this._db.Entry(membership)
                .Reference(member => member.Server)
                .LoadAsync(cancellationToken);
        }
    }

    private async Task<IReadOnlyCollection<Guid>>
        ResolveActiveServerUserIdsAsync(
            Guid serverId,
            CancellationToken cancellationToken)
    {
        return await this._db.ServerMembers
            .AsNoTracking()
            .Where(member =>
                member.ServerId == serverId &&
                member.StatusId == ServerMemberStatusIds.Active &&
                member.BannedAt == null &&
                member.Server.DeletedAt == null)
            .Select(member => member.UserId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
    }

    private static void ReactivateMembership(
        ServerMember membership,
        DateTime now)
    {
        membership.StatusId = ServerMemberStatusIds.Active;
        membership.JoinedAt = now;
        membership.LeftAt = null;
        membership.BannedAt = null;
        membership.BannedByUserId = null;
        membership.BanReason = null;
        membership.UpdatedAt = now;
    }

    internal static ServerJoinRequestResponse ToResponse(
        ServerJoinRequest joinRequest)
    {
        return new ServerJoinRequestResponse
        {
            Id = joinRequest.Id,
            ServerId = joinRequest.ServerId,
            UserId = joinRequest.UserId,
            StatusCode = joinRequest.StatusCode,
            CreatedAt = joinRequest.CreatedAt,
            UpdatedAt = joinRequest.UpdatedAt,
            ReviewedAt = joinRequest.ReviewedAt,
            ReviewedByUserId = joinRequest.ReviewedByUserId,
            User = new ServerJoinRequestUserResponse
            {
                Id = joinRequest.User.Id,
                Login = joinRequest.User.Login,
                DisplayName = joinRequest.User.Profile.DisplayName,
                AvatarAssetId = joinRequest.User.Profile.AvatarAssetId,
                AvatarCropOffsetX =
                    joinRequest.User.Profile.AvatarCropOffsetX,
                AvatarCropOffsetY =
                    joinRequest.User.Profile.AvatarCropOffsetY,
                AvatarCropZoom = joinRequest.User.Profile.AvatarCropZoom
            }
        };
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
