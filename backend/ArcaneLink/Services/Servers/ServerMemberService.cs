using System.Text.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Exceptions.ServerExceptions;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using ArcaneLink.Services.Spaces.Abstractions;
using ArcaneLink.Services.Users;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers
{
    public class ServerMemberService : IServerMemberService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly RealtimeServerGroupMembershipService _serverGroups;
        private readonly IServerGovernanceAccessService _access;
        private readonly IServerAuthorizationRuntime _serverAuthorization;
        private readonly IUserNotificationService _notifications;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly ServerVoiceAccessReconciliationService _voiceAccess;
        private readonly ILogger<ServerMemberService> _logger;
        private readonly IUserPresencePolicyService _presencePolicy;
        private readonly IUserPresenceCoordinator _presenceCoordinator;
        private readonly LegacyServerPermissionMaskAdapter _legacyPermissionAdapter = new();

        public ServerMemberService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            RealtimeServerGroupMembershipService serverGroups,
            IServerGovernanceAccessService access,
            IServerAuthorizationRuntime serverAuthorization,
            IUserNotificationService notifications,
            ISpaceAuthorizationService spaceAuthorization,
            ServerVoiceAccessReconciliationService voiceAccess,
            ILogger<ServerMemberService> logger,
            IUserPresencePolicyService presencePolicy,
            IUserPresenceCoordinator presenceCoordinator)
        {
            _db = db;
            _realtime = realtime;
            _serverGroups = serverGroups;
            _access = access;
            _serverAuthorization = serverAuthorization;
            _notifications = notifications;
            _spaceAuthorization = spaceAuthorization;
            _voiceAccess = voiceAccess;
            _logger = logger;
            _presencePolicy = presencePolicy;
            _presenceCoordinator = presenceCoordinator;
        }

        public async Task<ServerMemberPageResponse?> GetServerMembersAsync(
            Guid currentUserId,
            Guid serverId,
            int? afterPriority,
            DateTime? afterJoinedAt,
            Guid? afterId,
            string? query,
            Guid? roleId,
            int limit,
            CancellationToken cancellationToken = default)
        {
            var canViewMembers = await _access.IsActiveMemberAsync(
                currentUserId,
                serverId,
                cancellationToken);

            if (!canViewMembers)
            {
                return null;
            }

            var server = await _db.Servers
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (server == null)
            {
                return null;
            }

            var activeMembers = _db.ServerMembers
                .AsNoTracking()
                .Where(x => x.ServerId == serverId &&
                            x.StatusId == ServerMemberStatusIds.Active &&
                            x.BannedAt == null);
            var normalizedQuery = string.IsNullOrWhiteSpace(query)
                ? null
                : query.Trim().ToUpperInvariant();
            if (normalizedQuery != null)
            {
                activeMembers = activeMembers.Where(member =>
                    member.User.LoginNorm.Contains(normalizedQuery) ||
                    (member.ServerProfile != null &&
                     member.ServerProfile.DisplayNameNorm != null
                        ? member.ServerProfile.DisplayNameNorm
                        : member.User.Profile.DisplayNameNorm)
                    .Contains(normalizedQuery));
            }

            if (roleId.HasValue)
            {
                activeMembers = activeMembers.Where(member =>
                    member.Roles.Any(assignment =>
                        assignment.RoleId == roleId.Value &&
                        assignment.RevokedAt == null &&
                        assignment.Role.DeletedAt == null));
            }

            var totalCount = await activeMembers.CountAsync(cancellationToken);
            var membersQuery = activeMembers
                .AsSplitQuery()
                .Include(x => x.Status)
                .Include(x => x.User)
                    .ThenInclude(x => x.Profile)
                .Include(x => x.ServerProfile)
                .Include(x => x.Roles.Where(role => role.RevokedAt == null))
                    .ThenInclude(x => x.Role)
                        .ThenInclude(x => x.Permissions)
                            .ThenInclude(x => x.Permission)
                .AsQueryable();

            if (afterPriority.HasValue &&
                afterJoinedAt.HasValue &&
                afterId.HasValue)
            {
                var cursorPriority = afterPriority.Value;
                var cursorJoinedAt = NormalizeUtc(afterJoinedAt.Value);
                var cursorId = afterId.Value;

                membersQuery = membersQuery.Where(member =>
                    (member.UserId == server.OwnerUserId
                        ? 0
                        : member.UserId == currentUserId ? 1 : 2) >
                    cursorPriority ||
                    ((member.UserId == server.OwnerUserId
                            ? 0
                            : member.UserId == currentUserId ? 1 : 2) ==
                        cursorPriority &&
                     (member.JoinedAt > cursorJoinedAt ||
                      (member.JoinedAt == cursorJoinedAt &&
                       member.Id.CompareTo(cursorId) > 0))));
            }

            var pageSize = Math.Clamp(limit, 1, 100);
            var members = await membersQuery
                .OrderBy(member => member.UserId == server.OwnerUserId
                    ? 0
                    : member.UserId == currentUserId ? 1 : 2)
                .ThenBy(member => member.JoinedAt)
                .ThenBy(member => member.Id)
                .Take(pageSize + 1)
                .ToListAsync(cancellationToken);
            var hasMore = members.Count > pageSize;
            if (hasMore)
            {
                members.RemoveAt(members.Count - 1);
            }

            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                members.Select(member => member.UserId),
                cancellationToken);

            return new ServerMemberPageResponse
            {
                Items = members
                    .Select(member => ToMemberDetailsResponse(
                        member,
                        server.OwnerUserId,
                        presence.GetValueOrDefault(
                            member.UserId,
                            UserPresenceSnapshot.Hidden)))
                    .ToList(),
                NextCursor = hasMore && members.Count > 0
                    ? new ServerMemberCursorResponse
                    {
                        Priority = GetPaginationPriority(
                            members[^1].UserId,
                            server.OwnerUserId,
                            currentUserId),
                        JoinedAt = NormalizeUtc(members[^1].JoinedAt),
                        Id = members[^1].Id
                    }
                    : null,
                TotalCount = totalCount
            };
        }

        public async Task<ServerMemberDetailsResponse?> GetServerMemberByUserIdAsync(
            Guid currentUserId,
            Guid serverId,
            Guid targetUserId,
            CancellationToken cancellationToken = default)
        {
            var canViewMembers = await _access.IsActiveMemberAsync(
                currentUserId,
                serverId,
                cancellationToken);
            if (!canViewMembers)
            {
                return null;
            }

            var serverOwnerUserId = await _db.Servers
                .AsNoTracking()
                .Where(server => server.Id == serverId && server.DeletedAt == null)
                .Select(server => (Guid?)server.OwnerUserId)
                .FirstOrDefaultAsync(cancellationToken);
            if (!serverOwnerUserId.HasValue)
            {
                return null;
            }

            var member = await _db.ServerMembers
                .AsNoTracking()
                .AsSplitQuery()
                .Include(candidate => candidate.Status)
                .Include(candidate => candidate.User)
                    .ThenInclude(user => user.Profile)
                .Include(candidate => candidate.ServerProfile)
                .Include(candidate => candidate.Roles.Where(role => role.RevokedAt == null))
                    .ThenInclude(role => role.Role)
                        .ThenInclude(role => role.Permissions)
                            .ThenInclude(permission => permission.Permission)
                .FirstOrDefaultAsync(
                    candidate =>
                        candidate.ServerId == serverId &&
                        candidate.UserId == targetUserId &&
                        candidate.StatusId == ServerMemberStatusIds.Active &&
                        candidate.BannedAt == null,
                    cancellationToken);
            if (member == null)
            {
                return null;
            }

            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                [targetUserId],
                cancellationToken);

            return ToMemberDetailsResponse(
                member,
                serverOwnerUserId.Value,
                presence.GetValueOrDefault(
                    targetUserId,
                    UserPresenceSnapshot.Hidden));
        }

        public async Task<bool> LeaveServerAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            var server = await _db.Servers
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (server == null)
            {
                return false;
            }

            if (server.OwnerUserId == currentUserId)
            {
                throw new ServerOwnerCannotLeaveException();
            }

            var member = await _db.ServerMembers
                .FirstOrDefaultAsync(
                    x => x.ServerId == serverId &&
                         x.UserId == currentUserId &&
                         x.StatusId == ServerMemberStatusIds.Active &&
                         x.BannedAt == null,
                    cancellationToken);

            if (member == null)
            {
                return false;
            }

            var mutationSucceeded = false;
            var presenceSubjects = await _presenceCoordinator
                .ExecuteTopologyMutationAsync(
                    UserPresenceTopologyKey.Server(serverId),
                    [currentUserId],
                    token => ResolveActiveServerUserIdsAsync(serverId, token),
                    async token =>
                    {
                        await _db.Entry(server).ReloadAsync(token);
                        await _db.Entry(member).ReloadAsync(token);
                        if (server.DeletedAt != null ||
                            server.OwnerUserId == currentUserId ||
                            member.StatusId != ServerMemberStatusIds.Active ||
                            member.BannedAt != null)
                        {
                            return;
                        }

                        MarkMemberAsInactive(member, ServerMemberStatusIds.Left);
                        AddAudit(
                            serverId,
                            ServerGovernanceIds.AuditMemberLeft,
                            currentUserId,
                            currentUserId);
                        await _db.StageServerAclRevisionBumpAsync(serverId, token);
                        await _db.SaveChangesAsync(token);
                        mutationSucceeded = true;
                    },
                    cancellationToken);
            if (!mutationSucceeded)
            {
                return false;
            }

            await _presenceCoordinator.AudienceChangedAsync(
                presenceSubjects,
                CancellationToken.None);
            await _serverGroups.RemoveUserBestEffortAsync(
                currentUserId,
                serverId);
            _spaceAuthorization.InvalidateServer(serverId);
            await _voiceAccess.ReconcileServerBestEffortAsync(serverId);
            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                currentUserId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId },
                CancellationToken.None);
            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                currentUserId,
                RealtimeEventNames.UserServersChanged,
                new { serverId },
                CancellationToken.None);
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId, userId = currentUserId },
                CancellationToken.None);

            return true;
        }

        public async Task<bool> RemoveServerMemberAsync(
            Guid currentUserId,
            Guid serverId,
            Guid memberId,
            CancellationToken cancellationToken = default)
        {
            if (!await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "KICK_MEMBERS",
                    cancellationToken))
            {
                return false;
            }

            var server = await _db.Servers
                .FirstOrDefaultAsync(
                    x => x.Id == serverId &&
                         x.DeletedAt == null,
                    cancellationToken);

            if (server == null)
            {
                return false;
            }

            var member = await _db.ServerMembers
                .Include(x => x.Roles.Where(role => role.RevokedAt == null))
                    .ThenInclude(x => x.Role)
                        .ThenInclude(x => x.Permissions)
                .FirstOrDefaultAsync(
                    x => x.Id == memberId &&
                         x.ServerId == serverId &&
                         x.StatusId == ServerMemberStatusIds.Active &&
                         x.BannedAt == null,
                    cancellationToken);

            if (member == null)
            {
                return false;
            }

            if (member.UserId == server.OwnerUserId)
            {
                throw new ServerOwnerCannotBeRemovedException();
            }
            if (member.UserId == currentUserId)
            {
                return false;
            }

            if (!await CanModerateMemberAsync(
                    currentUserId,
                    server,
                    member,
                    "KICK_MEMBERS",
                    cancellationToken))
            {
                return false;
            }

            var mutationSucceeded = false;
            var presenceSubjects = await _presenceCoordinator
                .ExecuteTopologyMutationAsync(
                    UserPresenceTopologyKey.Server(serverId),
                    [currentUserId, member.UserId],
                    token => ResolveActiveServerUserIdsAsync(serverId, token),
                    async token =>
                    {
                        await _db.Entry(server).ReloadAsync(token);
                        await _db.Entry(member).ReloadAsync(token);
                        if (server.DeletedAt != null ||
                            member.StatusId != ServerMemberStatusIds.Active ||
                            member.BannedAt != null ||
                            member.UserId == server.OwnerUserId ||
                            member.UserId == currentUserId ||
                            !await CanModerateMemberAsync(
                                currentUserId,
                                server,
                                member,
                                "KICK_MEMBERS",
                                token))
                        {
                            return;
                        }

                        RevokeActiveRoles(member, currentUserId);
                        MarkMemberAsInactive(member, ServerMemberStatusIds.Removed);
                        AddAudit(
                            serverId,
                            ServerGovernanceIds.AuditMemberRemoved,
                            currentUserId,
                            member.UserId);
                        await _db.StageServerAclRevisionBumpAsync(serverId, token);
                        await _db.SaveChangesAsync(token);
                        mutationSucceeded = true;
                    },
                    cancellationToken);
            if (!mutationSucceeded)
            {
                return false;
            }

            await _presenceCoordinator.AudienceChangedAsync(
                presenceSubjects,
                CancellationToken.None);
            await _serverGroups.RemoveUserBestEffortAsync(
                member.UserId,
                serverId);
            _spaceAuthorization.InvalidateServer(serverId);
            await _voiceAccess.ReconcileServerBestEffortAsync(serverId);
            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                member.UserId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId },
                CancellationToken.None);
            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                member.UserId,
                RealtimeEventNames.UserServersChanged,
                new { serverId },
                CancellationToken.None);
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId, userId = member.UserId },
                CancellationToken.None);

            return true;
        }

        public async Task<ServerBanResponse?> BanServerMemberAsync(
            Guid currentUserId,
            Guid serverId,
            Guid memberId,
            BanServerMemberRequest request,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                return null;
            }

            if (!await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "BAN_MEMBERS",
                    cancellationToken))
            {
                return null;
            }

            var server = await _db.Servers
                .FirstOrDefaultAsync(
                    x => x.Id == serverId && x.DeletedAt == null,
                    cancellationToken);
            if (server == null)
            {
                return null;
            }

            var member = await _db.ServerMembers
                .Include(x => x.User)
                    .ThenInclude(x => x.Profile)
                .Include(x => x.Roles.Where(role => role.RevokedAt == null))
                    .ThenInclude(x => x.Role)
                        .ThenInclude(x => x.Permissions)
                .FirstOrDefaultAsync(
                    x => x.Id == memberId && x.ServerId == serverId,
                    cancellationToken);
            if (member == null)
            {
                return null;
            }

            if (member.UserId == server.OwnerUserId)
            {
                throw new ServerOwnerCannotBeBannedException();
            }

            if (member.UserId == currentUserId)
            {
                return null;
            }

            if (member.StatusId == ServerMemberStatusIds.Banned)
            {
                return await ToBanResponseAsync(
                    currentUserId,
                    member,
                    cancellationToken);
            }

            if (!await CanModerateMemberAsync(
                    currentUserId,
                    server,
                    member,
                    "BAN_MEMBERS",
                    cancellationToken))
            {
                return null;
            }

            var reason = request.Reason.Trim();
            List<ServerInvite> revokedDirectInvites = [];
            var notificationChanged = false;
            var mutationSucceeded = false;
            var presenceSubjects = await _presenceCoordinator
                .ExecuteTopologyMutationAsync(
                    UserPresenceTopologyKey.Server(serverId),
                    [currentUserId, member.UserId],
                    token => ResolveActiveServerUserIdsAsync(serverId, token),
                    async token =>
                    {
                        await _db.Entry(server).ReloadAsync(token);
                        await _db.Entry(member).ReloadAsync(token);
                        if (server.DeletedAt != null ||
                            member.StatusId == ServerMemberStatusIds.Banned ||
                            member.UserId == server.OwnerUserId ||
                            member.UserId == currentUserId ||
                            !await CanModerateMemberAsync(
                                currentUserId,
                                server,
                                member,
                                "BAN_MEMBERS",
                                token))
                        {
                            return;
                        }

                        var now = DateTime.UtcNow;
                        RevokeActiveRoles(member, currentUserId, now);
                        member.StatusId = ServerMemberStatusIds.Banned;
                        member.LeftAt = now;
                        member.BannedAt = now;
                        member.BannedByUserId = currentUserId;
                        member.BanReason = reason;
                        member.UpdatedAt = now;

                        revokedDirectInvites = await _db.ServerInvites
                            .Where(invite =>
                                invite.ServerId == serverId &&
                                invite.TargetUserId == member.UserId &&
                                invite.KindId ==
                                    ServerGovernanceIds.InviteKindDirect &&
                                invite.RevokedAt == null)
                            .ToListAsync(token);
                        foreach (var directInvite in revokedDirectInvites)
                        {
                            directInvite.RevokedAt = now;
                            directInvite.RevokedByUserId = currentUserId;
                            notificationChanged |= await _notifications
                                .StageInviteReadAsync(
                                    member.UserId,
                                    directInvite.Id,
                                    token);
                        }

                        _access.AddAudit(
                            serverId,
                            ServerGovernanceIds.AuditMemberBanned,
                            currentUserId,
                            member.UserId,
                            payload: JsonSerializer.Serialize(new { reason }));
                        await _db.StageServerAclRevisionBumpAsync(serverId, token);
                        await _db.SaveChangesAsync(token);
                        mutationSucceeded = true;
                    },
                    cancellationToken);
            if (!mutationSucceeded)
            {
                return member.StatusId == ServerMemberStatusIds.Banned
                    ? await ToBanResponseAsync(
                        currentUserId,
                        member,
                        cancellationToken)
                    : null;
            }

            await _presenceCoordinator.AudienceChangedAsync(
                presenceSubjects,
                CancellationToken.None);

            await FinalizeMembershipRemovalBestEffortAsync(
                serverId,
                member.UserId);
            if (notificationChanged)
            {
                await _notifications.NotifyChangedAsync(
                    [member.UserId],
                    CancellationToken.None);
            }
            foreach (var invite in revokedDirectInvites)
            {
                await _realtime.NotifyUserBestEffortAsync(
                    _logger,
                    member.UserId,
                    RealtimeEventNames.ServerInviteReceived,
                    new { serverId, inviteId = invite.Id },
                    CancellationToken.None);
            }
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, memberId },
                CancellationToken.None);

            return await ToBanResponseAsync(
                currentUserId,
                member,
                cancellationToken);
        }

        public async Task<IReadOnlyList<ServerBanResponse>?> GetServerBansAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            if (!await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "MANAGE_BANS",
                    cancellationToken))
            {
                return null;
            }

            var bans = await _db.ServerMembers
                .AsNoTracking()
                .Include(member => member.User)
                    .ThenInclude(user => user.Profile)
                .Where(member =>
                    member.ServerId == serverId &&
                    member.Server.DeletedAt == null &&
                    member.StatusId == ServerMemberStatusIds.Banned)
                .OrderByDescending(member => member.BannedAt)
                .ToListAsync(cancellationToken);
            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                bans.Select(member => member.UserId),
                cancellationToken);

            return bans
                .Select(member => ToBanResponse(
                    member,
                    presence.GetValueOrDefault(
                        member.UserId,
                        UserPresenceSnapshot.Hidden)))
                .ToList();
        }

        public async Task<bool> UnbanServerMemberAsync(
            Guid currentUserId,
            Guid serverId,
            Guid memberId,
            CancellationToken cancellationToken = default)
        {
            if (!await _access.HasGranularPermissionAsync(
                    currentUserId,
                    serverId,
                    "MANAGE_BANS",
                    cancellationToken))
            {
                return false;
            }

            var member = await _db.ServerMembers.FirstOrDefaultAsync(
                x => x.Id == memberId &&
                     x.ServerId == serverId &&
                     x.StatusId == ServerMemberStatusIds.Banned &&
                     x.Server.DeletedAt == null,
                cancellationToken);
            if (member == null)
            {
                return false;
            }

            var now = DateTime.UtcNow;
            var reason = member.BanReason;
            member.StatusId = ServerMemberStatusIds.Removed;
            member.BannedAt = null;
            member.BannedByUserId = null;
            member.BanReason = null;
            member.UpdatedAt = now;

            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditMemberUnbanned,
                currentUserId,
                member.UserId,
                payload: JsonSerializer.Serialize(new { reason }));
            await _db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            _spaceAuthorization.InvalidateServer(serverId);
            await _voiceAccess.ReconcileServerBestEffortAsync(serverId);
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, memberId },
                CancellationToken.None);

            return true;
        }

        private async Task FinalizeMembershipRemovalBestEffortAsync(
            Guid serverId,
            Guid userId)
        {
            await _serverGroups.RemoveUserBestEffortAsync(userId, serverId);
            _spaceAuthorization.InvalidateServer(serverId);
            await _voiceAccess.ReconcileServerBestEffortAsync(serverId);
            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                userId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId },
                CancellationToken.None);
            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                userId,
                RealtimeEventNames.UserServersChanged,
                new { serverId },
                CancellationToken.None);
            await _realtime.NotifyServerBestEffortAsync(
                _logger,
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId, userId },
                CancellationToken.None);
        }

        private async Task<IReadOnlyCollection<Guid>> ResolveActiveServerUserIdsAsync(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return await _db.ServerMembers
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

        private static void MarkMemberAsInactive(
            ServerMember member,
            Guid statusId)
        {
            var now = DateTime.UtcNow;

            member.StatusId = statusId;
            member.LeftAt = now;
            member.UpdatedAt = now;
        }

        private static void RevokeActiveRoles(
            ServerMember member,
            Guid actorUserId,
            DateTime? revokedAt = null)
        {
            var now = revokedAt ?? DateTime.UtcNow;
            var changed = false;
            foreach (var assignment in member.Roles.Where(role => role.RevokedAt == null))
            {
                assignment.RevokedAt = now;
                assignment.RevokedByUserId = actorUserId;
                changed = true;
            }

            if (changed)
            {
                member.RolesVersion = Guid.NewGuid();
                member.DisplayColorMode = ServerMemberDisplayColorModeCodes.Auto;
                member.DisplayColorRoleId = null;
            }
        }

        private async Task<bool> CanModerateMemberAsync(
            Guid actorUserId,
            Server server,
            ServerMember target,
            string permissionCode,
            CancellationToken cancellationToken)
        {
            if (target.UserId == actorUserId)
            {
                return false;
            }

            var actorContext = await _serverAuthorization.GetContextAsync(
                actorUserId,
                server.Id,
                cancellationToken);
            if (actorContext == null ||
                !TryCreateModerationSubject(
                    server,
                    target,
                    actorContext.Principal.EveryoneRole,
                    out var subject))
            {
                return false;
            }

            return ServerAuthorizationEvaluator.IsAllowed(
                actorContext.Principal,
                new ServerAuthorizationRequest(
                    server.Id,
                    permissionCode,
                    OwnerOnly: false,
                    DependencyCodes: [],
                    PermissionResource: null,
                    Target: new ServerAuthorizationSubjectTarget(subject)));
        }

        private bool TryCreateModerationSubject(
            Server server,
            ServerMember member,
            ServerAuthorizationRole everyoneRole,
            out ServerAuthorizationPrincipal subject)
        {
            subject = null!;
            var roles = new List<ServerAuthorizationRole>();
            foreach (var assignment in member.Roles.Where(assignment =>
                         assignment.RevokedAt == null &&
                         assignment.Role.DeletedAt == null))
            {
                var role = assignment.Role;
                var kind = role.Kind switch
                {
                    ServerRoleKindCodes.Standard =>
                        ServerAuthorizationRoleKind.Standard,
                    ServerRoleKindCodes.Integration =>
                        ServerAuthorizationRoleKind.Integration,
                    _ => (ServerAuthorizationRoleKind?)null
                };
                if (!kind.HasValue ||
                    !ServerRolePermissionMaskResolver.TryResolve(
                        role,
                        _legacyPermissionAdapter,
                        out var permissionMask,
                        out _))
                {
                    return false;
                }

                roles.Add(new ServerAuthorizationRole(
                    role.Id,
                    role.ServerId,
                    kind.Value,
                    role.Level,
                    permissionMask));
            }

            subject = new ServerAuthorizationPrincipal(
                server.Id,
                member.Id,
                IsActiveMember: true,
                IsOwner: member.UserId == server.OwnerUserId,
                everyoneRole,
                roles);
            return true;
        }

        private void AddAudit(
            Guid serverId,
            Guid eventTypeId,
            Guid actorUserId,
            Guid targetUserId)
        {
            _db.ServerAuditLogs.Add(new ServerAuditLog
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                EventTypeId = eventTypeId,
                ActorUserId = actorUserId,
                TargetUserId = targetUserId,
                CreatedAt = DateTime.UtcNow
            });
        }

        private static int GetPaginationPriority(
            Guid userId,
            Guid ownerUserId,
            Guid currentUserId)
        {
            if (userId == ownerUserId)
            {
                return 0;
            }

            return userId == currentUserId ? 1 : 2;
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

        private static ServerMemberDetailsResponse ToMemberDetailsResponse(
            ServerMember member,
            Guid ownerUserId,
            UserPresenceSnapshot presence)
        {
            return new ServerMemberDetailsResponse
            {
                Id = member.Id,
                ServerId = member.ServerId,
                UserId = member.UserId,
                StatusCode = member.Status.Code,
                IsOwner = member.UserId == ownerUserId,
                JoinedAt = member.JoinedAt,
                LeftAt = member.LeftAt,
                AddedByUserId = member.AddedByUserId,
                CreatedAt = member.CreatedAt,
                UpdatedAt = member.UpdatedAt,
                PermissionCodes = member.Roles
                    .Where(role => role.RevokedAt == null)
                    .SelectMany(role => role.Role.Permissions)
                    .Where(permission => permission.IsGranted)
                    .Select(permission => permission.Permission.Code)
                    .Distinct()
                    .ToList(),
                RoleAssignments = member.Roles
                    .Where(assignment =>
                        assignment.RevokedAt == null &&
                        assignment.Role.DeletedAt == null)
                    .Select(assignment =>
                        ServerGovernanceMapper.ToMemberRoleResponse(
                            assignment,
                            assignment.Role.Title))
                    .ToList(),
                User = ToMemberUserResponse(member, presence)
            };
        }

        private static ServerMemberUserResponse ToMemberUserResponse(
            ServerMember member,
            UserPresenceSnapshot presence)
        {
            var user = member.User;
            var global = user.Profile;
            var server = member.ServerProfile;
            return new ServerMemberUserResponse
            {
                Id = user.Id,
                Login = user.Login,
                DisplayName = server?.DisplayName ?? global.DisplayName,
                AvatarAssetId = server?.AvatarAssetId ?? global.AvatarAssetId,
                AvatarCropOffsetX = server?.AvatarAssetId != null
                    ? 0
                    : global.AvatarCropOffsetX,
                AvatarCropOffsetY = server?.AvatarAssetId != null
                    ? 0
                    : global.AvatarCropOffsetY,
                AvatarCropZoom = server?.AvatarAssetId != null
                    ? 1
                    : global.AvatarCropZoom,
                BannerAssetId = server?.BannerAssetId ?? global.BannerAssetId,
                About = server?.About ?? global.Bio,
                ServerStatusText = server?.StatusText,
                UsesServerProfile = server != null,
                PresenceStatus = presence.PresenceStatus,
                LastSeenAt = presence.LastSeenAt
            };
        }

        private static ServerMemberUserResponse ToMemberUserResponse(
            User user,
            UserPresenceSnapshot presence)
        {
            return new ServerMemberUserResponse
            {
                Id = user.Id,
                Login = user.Login,
                DisplayName = user.Profile.DisplayName,
                AvatarAssetId = user.Profile.AvatarAssetId,
                AvatarCropOffsetX = user.Profile.AvatarCropOffsetX,
                AvatarCropOffsetY = user.Profile.AvatarCropOffsetY,
                AvatarCropZoom = user.Profile.AvatarCropZoom,
                PresenceStatus = presence.PresenceStatus,
                LastSeenAt = presence.LastSeenAt
            };
        }

        private async Task<ServerBanResponse> ToBanResponseAsync(
            Guid currentUserId,
            ServerMember member,
            CancellationToken cancellationToken)
        {
            var presence = await _presencePolicy.ResolveAsync(
                currentUserId,
                [member.UserId],
                cancellationToken);

            return ToBanResponse(
                member,
                presence.GetValueOrDefault(
                    member.UserId,
                    UserPresenceSnapshot.Hidden));
        }

        private static ServerBanResponse ToBanResponse(
            ServerMember member,
            UserPresenceSnapshot presence)
        {
            return new ServerBanResponse
            {
                ServerId = member.ServerId,
                MemberId = member.Id,
                UserId = member.UserId,
                BannedAt = member.BannedAt ?? member.UpdatedAt,
                BannedByUserId = member.BannedByUserId,
                Reason = member.BanReason ?? "",
                User = ToMemberUserResponse(member.User, presence)
            };
        }
    }
}
