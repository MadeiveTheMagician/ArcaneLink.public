using System.Security.Cryptography;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Observability;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers
{
    public class ServerInviteService : IServerInviteService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly IServerGovernanceAccessService _access;
        private readonly ServerPermissionRealtimeAudienceService _permissionAudience;
        private readonly ServerInviteEligibilityService _eligibility;
        private readonly ILogger<ServerInviteService> _logger;
        private readonly IUserNotificationService _notifications;

        public ServerInviteService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            IServerGovernanceAccessService access,
            ServerPermissionRealtimeAudienceService permissionAudience,
            ServerInviteEligibilityService eligibility,
            IUserNotificationService notifications,
            ILogger<ServerInviteService> logger)
        {
            _db = db;
            _realtime = realtime;
            _access = access;
            _permissionAudience = permissionAudience;
            _eligibility = eligibility;
            _notifications = notifications;
            _logger = logger;
        }

        public async Task<ServerInviteResponse?> CreateInviteAsync(
            Guid currentUserId,
            Guid serverId,
            CreateServerInviteRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!await _access.CanCreateInvitesAsync(currentUserId, serverId, cancellationToken))
            {
                return null;
            }

            var kindCode = ServerInviteRules.NormalizeCode(request.KindCode);
            var kindId = kindCode == ServerInviteRules.DirectKindCode
                ? ServerGovernanceIds.InviteKindDirect
                : ServerGovernanceIds.InviteKindLink;
            var now = DateTime.UtcNow;

            if (kindCode == ServerInviteRules.DirectKindCode)
            {
                if (request.TargetUserId == null ||
                    request.TargetUserId == currentUserId ||
                    await _eligibility.IsActiveServerMemberAsync(
                        request.TargetUserId.Value,
                        serverId,
                        cancellationToken) ||
                    await _eligibility.IsBannedServerMemberAsync(
                        request.TargetUserId.Value,
                        serverId,
                        cancellationToken))
                {
                    return null;
                }

                var existingDirectInvite = await _eligibility.LoadActiveDirectInviteAsync(
                    currentUserId,
                    serverId,
                    request.TargetUserId,
                    now,
                    cancellationToken);

                if (existingDirectInvite != null)
                {
                    return existingDirectInvite;
                }

                if (!await _eligibility.CanCreateDirectInviteToTargetAsync(
                        currentUserId,
                        serverId,
                        request.TargetUserId.Value,
                        cancellationToken))
                {
                    return null;
                }
            }

            var invite = new ServerInvite
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                CreatedByUserId = currentUserId,
                KindId = kindId,
                Code = kindCode == ServerInviteRules.LinkKindCode
                    ? await GenerateInviteCodeAsync(cancellationToken)
                    : null,
                TargetUserId = kindCode == ServerInviteRules.DirectKindCode
                    ? request.TargetUserId
                    : null,
                MaxUses = kindCode == ServerInviteRules.DirectKindCode
                    ? 1
                    : request.MaxUses is > 0 ? request.MaxUses : null,
                UsedCount = 0,
                ExpiresAt = kindCode == ServerInviteRules.DirectKindCode
                    ? now + ServerInviteRules.DirectInviteLifetime
                    : request.ExpiresAt,
                CreatedAt = now
            };

            _db.ServerInvites.Add(invite);
            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditInviteCreated,
                currentUserId,
                request.TargetUserId,
                relatedInviteId: invite.Id);
            if (invite.TargetUserId != null)
            {
                await _notifications.StageDirectInviteAsync(
                    invite.TargetUserId.Value,
                    currentUserId,
                    serverId,
                    invite.Id,
                    cancellationToken);
            }
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation(
                ObservabilityEventIds.ServerInviteCreated,
                "Server invite created. ServerId={ServerId} InviteId={InviteId} CreatedByUserId={CreatedByUserId} Kind={Kind} TargetUserId={TargetUserId} ExpiresAt={ExpiresAt} MaxUses={MaxUses}",
                serverId,
                invite.Id,
                currentUserId,
                kindCode,
                invite.TargetUserId,
                invite.ExpiresAt,
                invite.MaxUses);

            await NotifyInviteAudienceAsync(
                serverId,
                invite.Id,
                [currentUserId],
                CancellationToken.None);

            if (invite.TargetUserId != null)
            {
                await _notifications.NotifyChangedAsync(
                    [invite.TargetUserId.Value],
                    CancellationToken.None);
                await _realtime.NotifyUserBestEffortAsync(
                    _logger,
                    invite.TargetUserId.Value,
                    RealtimeEventNames.ServerInviteReceived,
                    new { serverId, inviteId = invite.Id },
                    CancellationToken.None);
            }

            invite.Kind = await _db.ServerInviteKinds.FindAsync([kindId], cancellationToken)
                ?? new ServerInviteKind { Id = kindId, Code = kindCode, Title = kindCode };

            return ServerGovernanceMapper.ToInviteResponse(invite, now);
        }

        public async Task<bool> RevokeInviteAsync(
            Guid currentUserId,
            Guid serverId,
            Guid inviteId,
            CancellationToken cancellationToken = default)
        {
            var canCreateInvites = await _access.CanCreateInvitesAsync(
                currentUserId,
                serverId,
                cancellationToken);
            var canManageInvites = await _access.HasGranularPermissionAsync(
                currentUserId,
                serverId,
                "MANAGE_INVITES",
                cancellationToken);
            if (!canCreateInvites && !canManageInvites)
            {
                return false;
            }

            var invite = await _db.ServerInvites.FirstOrDefaultAsync(
                x => x.Id == inviteId &&
                     x.ServerId == serverId,
                cancellationToken);

            if (invite == null)
            {
                return false;
            }

            if (invite.CreatedByUserId != currentUserId && !canManageInvites)
            {
                return false;
            }

            invite.RevokedAt = DateTime.UtcNow;
            invite.RevokedByUserId = currentUserId;
            _access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditInviteRevoked,
                currentUserId,
                invite.TargetUserId,
                relatedInviteId: invite.Id);
            var notificationChanged = invite.TargetUserId != null &&
                await _notifications.StageInviteReadAsync(
                    invite.TargetUserId.Value,
                    invite.Id,
                    cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            await NotifyInviteAudienceAsync(
                serverId,
                invite.Id,
                [currentUserId, invite.CreatedByUserId],
                cancellationToken);

            if (invite.TargetUserId != null)
            {
                if (notificationChanged)
                {
                    await _notifications.NotifyChangedAsync(
                        [invite.TargetUserId.Value],
                        cancellationToken);
                }
                await _realtime.NotifyUserBestEffortAsync(
                    _logger,
                    invite.TargetUserId.Value,
                    RealtimeEventNames.ServerInviteReceived,
                    new { serverId, inviteId = invite.Id },
                    cancellationToken);
            }

            return true;
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
                if (await _access.HasGranularPermissionAsync(
                        userId,
                        serverId,
                        "CREATE_INVITES",
                        cancellationToken))
                {
                    ownInviteAudience.Add(userId);
                }
            }

            var audience = await _permissionAudience.ResolveAsync(
                serverId,
                ["VIEW_INVITE_LOG", "MANAGE_INVITES"],
                ownInviteAudience,
                cancellationToken: cancellationToken);
            await _realtime.NotifyUsersBestEffortAsync(
                _logger,
                audience,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId, inviteId },
                cancellationToken);
        }

        private async Task<string> GenerateInviteCodeAsync(CancellationToken cancellationToken)
        {
            for (var attempt = 0; attempt < 20; attempt++)
            {
                var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();
                var exists = await _db.ServerInvites.AnyAsync(x => x.Code == code, cancellationToken);
                if (!exists)
                {
                    return code;
                }
            }

            return Guid.NewGuid().ToString("N")[..16];
        }
    }
}
