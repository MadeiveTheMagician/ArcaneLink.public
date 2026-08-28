using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers;

public class ServerInviteAcceptanceService : IServerInviteAcceptanceService
{
    private readonly AppDbContext _db;
    private readonly IRealtimeNotificationService _realtime;
    private readonly RealtimeServerGroupMembershipService _serverGroups;
    private readonly IServerGovernanceAccessService _access;
    private readonly ServerPermissionRealtimeAudienceService _permissionAudience;
    private readonly IUserNotificationService _notifications;
    private readonly IUserPresenceCoordinator _presenceCoordinator;
    private readonly ILogger<ServerInviteAcceptanceService> _logger;

    public ServerInviteAcceptanceService(
        AppDbContext db,
        IRealtimeNotificationService realtime,
        RealtimeServerGroupMembershipService serverGroups,
        IServerGovernanceAccessService access,
        ServerPermissionRealtimeAudienceService permissionAudience,
        IUserNotificationService notifications,
        IUserPresenceCoordinator presenceCoordinator,
        ILogger<ServerInviteAcceptanceService> logger)
    {
        this._db = db;
        this._realtime = realtime;
        this._serverGroups = serverGroups;
        this._access = access;
        this._permissionAudience = permissionAudience;
        this._notifications = notifications;
        this._presenceCoordinator = presenceCoordinator;
        this._logger = logger;
    }

    public async Task<ServerMemberResponse?> AcceptInviteAsync(
        Guid currentUserId,
        AcceptServerInviteRequest request,
        CancellationToken cancellationToken = default)
    {
        var code = request.Code.Trim();
        var invite = await this._db.ServerInvites
            .Include(x => x.Kind)
            .Include(x => x.Server)
            .FirstOrDefaultAsync(
                x => x.Code == code &&
                     x.KindId == ServerGovernanceIds.InviteKindLink,
                cancellationToken);

        return invite == null
            ? null
            : await this.AcceptInviteCoreAsync(currentUserId, invite, cancellationToken);
    }

    public async Task<ServerMemberResponse?> AcceptInviteAsync(
        Guid currentUserId,
        Guid inviteId,
        CancellationToken cancellationToken = default)
    {
        var invite = await this._db.ServerInvites
            .Include(x => x.Kind)
            .Include(x => x.Server)
            .FirstOrDefaultAsync(x => x.Id == inviteId, cancellationToken);

        if (invite == null ||
            invite.KindId != ServerGovernanceIds.InviteKindDirect ||
            invite.TargetUserId != currentUserId)
        {
            return null;
        }

        return await this.AcceptInviteCoreAsync(currentUserId, invite, cancellationToken);
    }

    public async Task<bool> DeclineInviteAsync(
        Guid currentUserId,
        Guid inviteId,
        CancellationToken cancellationToken = default)
    {
        var invite = await this._db.ServerInvites
            .Include(x => x.Server)
            .FirstOrDefaultAsync(
                x =>
                    x.Id == inviteId &&
                    x.KindId == ServerGovernanceIds.InviteKindDirect &&
                    x.TargetUserId == currentUserId,
                cancellationToken);

        if (invite == null || !ServerInviteRules.IsActive(invite, DateTime.UtcNow))
        {
            return false;
        }

        invite.RevokedAt = DateTime.UtcNow;
        invite.RevokedByUserId = currentUserId;
        var notificationChanged = await this._notifications.StageInviteReadAsync(
            currentUserId,
            invite.Id,
            cancellationToken);
        await this._db.SaveChangesAsync(cancellationToken);
        if (notificationChanged)
        {
            await this._notifications.NotifyChangedAsync(
                [currentUserId],
                cancellationToken);
        }
        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            currentUserId,
            RealtimeEventNames.ServerInviteReceived,
            new { serverId = invite.ServerId, inviteId = invite.Id },
            cancellationToken);
        await this.NotifyInviteAudienceAsync(
            invite.ServerId,
            invite.Id,
            [invite.CreatedByUserId],
            cancellationToken);

        return true;
    }

    private async Task<ServerMemberResponse?> AcceptInviteCoreAsync(
        Guid currentUserId,
        ServerInvite invite,
        CancellationToken cancellationToken)
    {
        var serverId = invite.ServerId;
        ServerMember? member = null;
        var wasActiveMember = false;
        var notificationChanged = false;
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
                    await this._db.Entry(invite).ReloadAsync(token);
                    if (invite.Server != null)
                    {
                        await this._db.Entry(invite.Server).ReloadAsync(token);
                    }

                    var now = DateTime.UtcNow;
                    if (!ServerInviteRules.IsActive(invite, now))
                    {
                        return;
                    }

                    member = await this._db.ServerMembers
                        .Include(x => x.Status)
                        .FirstOrDefaultAsync(
                            x => x.ServerId == serverId &&
                                 x.UserId == currentUserId,
                            token);
                    wasActiveMember = member?.StatusId ==
                        ServerMemberStatusIds.Active;
                    if (member?.StatusId == ServerMemberStatusIds.Banned)
                    {
                        return;
                    }

                    if (member == null)
                    {
                        member = new ServerMember
                        {
                            Id = Guid.NewGuid(),
                            ServerId = serverId,
                            UserId = currentUserId,
                            StatusId = ServerMemberStatusIds.Active,
                            JoinedAt = now,
                            AddedByUserId = invite.CreatedByUserId,
                            CreatedAt = now,
                            UpdatedAt = now
                        };
                        this._db.ServerMembers.Add(member);
                    }
                    else if (!wasActiveMember)
                    {
                        var updatedMemberships = await this._db.ServerMembers
                            .Where(x =>
                                x.Id == member.Id &&
                                x.StatusId != ServerMemberStatusIds.Banned)
                            .ExecuteUpdateAsync(
                                setters => setters
                                    .SetProperty(
                                        x => x.StatusId,
                                        ServerMemberStatusIds.Active)
                                    .SetProperty(x => x.JoinedAt, now)
                                    .SetProperty(x => x.LeftAt, (DateTime?)null)
                                    .SetProperty(x => x.BannedAt, (DateTime?)null)
                                    .SetProperty(x => x.BannedByUserId, (Guid?)null)
                                    .SetProperty(x => x.BanReason, (string?)null)
                                    .SetProperty(x => x.UpdatedAt, now),
                                token);
                        if (updatedMemberships == 0)
                        {
                            return;
                        }

                        await this._db.Entry(member).ReloadAsync(token);
                        this._db.Entry(member).Reference(x => x.Status).IsLoaded = false;
                    }

                    var hasUsage = await this._db.ServerInviteUsages.AnyAsync(
                        x => x.InviteId == invite.Id &&
                             x.UserId == currentUserId,
                        token);
                    if (!hasUsage)
                    {
                        invite.UsedCount++;
                        this._db.ServerInviteUsages.Add(new ServerInviteUsage
                        {
                            Id = Guid.NewGuid(),
                            InviteId = invite.Id,
                            UserId = currentUserId,
                            UsedAt = now
                        });
                    }

                    if (!wasActiveMember)
                    {
                        this._access.AddAudit(
                            serverId,
                            ServerGovernanceIds.AuditMemberJoined,
                            invite.CreatedByUserId,
                            currentUserId,
                            relatedInviteId: invite.Id);
                    }

                    notificationChanged = await this._notifications
                        .StageInviteReadAsync(
                            currentUserId,
                            invite.Id,
                            token);
                    if (!wasActiveMember)
                    {
                        await this._db.StageServerAclRevisionBumpAsync(
                            serverId,
                            token);
                    }

                    await this._db.ServerJoinRequests
                        .Where(joinRequest =>
                            joinRequest.ServerId == serverId &&
                            joinRequest.UserId == currentUserId &&
                            joinRequest.StatusCode ==
                                ServerJoinRequestStatusCodes.Pending)
                        .ExecuteUpdateAsync(
                            setters => setters
                                .SetProperty(
                                    joinRequest => joinRequest.StatusCode,
                                    ServerJoinRequestStatusCodes.Approved)
                                .SetProperty(
                                    joinRequest => joinRequest.ReviewedAt,
                                    (DateTime?)now)
                                .SetProperty(
                                    joinRequest =>
                                        joinRequest.ReviewedByUserId,
                                    invite.CreatedByUserId)
                                .SetProperty(
                                    joinRequest => joinRequest.UpdatedAt,
                                    now),
                            token);

                    await this._db.SaveChangesAsync(token);
                    await transaction.CommitAsync(token);
                    mutationSucceeded = true;
                },
                cancellationToken);
        if (!mutationSucceeded || member == null)
        {
            return null;
        }

        if (!wasActiveMember)
        {
            await this._presenceCoordinator.AudienceChangedAsync(
                presenceSubjects,
                CancellationToken.None);
            await this._serverGroups.AddUserBestEffortAsync(
                currentUserId,
                invite.ServerId);
        }
        if (notificationChanged)
        {
            await this._notifications.NotifyChangedAsync(
                [currentUserId],
                cancellationToken);
        }

        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            currentUserId,
            RealtimeEventNames.ServerInviteAccepted,
            new { serverId = invite.ServerId, inviteId = invite.Id },
            cancellationToken);
        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            currentUserId,
            RealtimeEventNames.UserServersChanged,
            new { serverId = invite.ServerId, inviteId = invite.Id },
            cancellationToken);
        await this._realtime.NotifyServerBestEffortAsync(
            this._logger,
            invite.ServerId,
            RealtimeEventNames.ServerMembersChanged,
            new { serverId = invite.ServerId, userId = currentUserId },
            cancellationToken);
        await this.NotifyInviteAudienceAsync(
            invite.ServerId,
            invite.Id,
            [invite.CreatedByUserId],
            cancellationToken);
        await this.NotifyJoinRequestAudienceAsync(
            invite.ServerId,
            cancellationToken);
        await this._realtime.NotifyUserBestEffortAsync(
            this._logger,
            currentUserId,
            RealtimeEventNames.ServerJoinRequestChanged,
            new { serverId = invite.ServerId },
            cancellationToken);

        await this._db.Entry(member).Reference(x => x.Status).LoadAsync(cancellationToken);
        await this._db.Entry(member).Reference(x => x.Server).LoadAsync(cancellationToken);

        return ServerGovernanceMapper.ToServerMemberResponse(member);
    }

    private async Task NotifyInviteAudienceAsync(
        Guid serverId,
        Guid inviteId,
        IEnumerable<Guid> explicitlyIncludedUserIds,
        CancellationToken cancellationToken)
    {
        var ownInviteAudience = new List<Guid>();
        foreach (var userId in explicitlyIncludedUserIds.Distinct())
        {
            if (await this._access.HasGranularPermissionAsync(
                    userId,
                    serverId,
                    "CREATE_INVITES",
                    cancellationToken))
            {
                ownInviteAudience.Add(userId);
            }
        }

        var audience = await this._permissionAudience.ResolveAsync(
            serverId,
            ["VIEW_INVITE_LOG", "MANAGE_INVITES"],
            ownInviteAudience,
            cancellationToken: cancellationToken);
        await this._realtime.NotifyUsersBestEffortAsync(
            this._logger,
            audience,
            RealtimeEventNames.ServerGovernanceChanged,
            new { serverId, inviteId },
            cancellationToken);
    }

    private async Task NotifyJoinRequestAudienceAsync(
        Guid serverId,
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
            new { serverId },
            cancellationToken);
    }

    private async Task<IReadOnlyCollection<Guid>> ResolveActiveServerUserIdsAsync(
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
}
