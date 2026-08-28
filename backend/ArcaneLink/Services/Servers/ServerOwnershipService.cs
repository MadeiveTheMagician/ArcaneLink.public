using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers
{
    public class ServerOwnershipService : IServerOwnershipService
    {
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly IServerGovernanceAccessService _access;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly ServerVoiceAccessReconciliationService _voiceAccess;
        private readonly ILogger<ServerOwnershipService> _logger;

        public ServerOwnershipService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            IServerGovernanceAccessService access,
            ISpaceAuthorizationService spaceAuthorization,
            ServerVoiceAccessReconciliationService voiceAccess,
            ILogger<ServerOwnershipService> logger)
        {
            this._db = db;
            this._realtime = realtime;
            this._access = access;
            this._spaceAuthorization = spaceAuthorization;
            this._voiceAccess = voiceAccess;
            this._logger = logger;
        }

        public async Task<ServerOwnershipTransferResponse?> TransferOwnershipAsync(
            Guid currentUserId,
            Guid serverId,
            TransferServerOwnershipRequest request,
            CancellationToken cancellationToken = default)
        {
            var server = await this._db.Servers.FirstOrDefaultAsync(
                x => x.Id == serverId &&
                     x.DeletedAt == null,
                cancellationToken);

            if (server == null || server.OwnerUserId != currentUserId)
            {
                return null;
            }

            var targetMember = await this._db.ServerMembers.FirstOrDefaultAsync(
                x => x.Id == request.ToMemberId &&
                     x.ServerId == serverId &&
                     x.StatusId == ServerMemberStatusIds.Active,
                cancellationToken);

            if (targetMember == null || targetMember.UserId == currentUserId)
            {
                return null;
            }

            var now = DateTime.UtcNow;
            var currentOwnerMember = await this._db.ServerMembers
                .FirstOrDefaultAsync(
                    x => x.ServerId == serverId &&
                         x.UserId == currentUserId &&
                         x.StatusId == ServerMemberStatusIds.Active,
                    cancellationToken);
            var ownerRole = await this._access.EnsureOwnerRoleAsync(serverId, cancellationToken);
            var transfer = new ServerOwnershipTransfer
            {
                Id = Guid.NewGuid(),
                ServerId = serverId,
                FromUserId = currentUserId,
                ToUserId = targetMember.UserId,
                TransferTypeId = ServerGovernanceIds.OwnershipTransferVoluntary,
                Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
                ExecutedByUserId = currentUserId,
                TransferredAt = now
            };

            server.OwnerUserId = targetMember.UserId;
            server.UpdatedAt = now;

            if (ownerRole != null && currentOwnerMember != null)
            {
                var oldAssignment = await this._db.ServerMemberRoles
                    .FirstOrDefaultAsync(
                        x => x.ServerId == serverId &&
                             x.MemberId == currentOwnerMember.Id &&
                             x.RoleId == ownerRole.Id &&
                             x.RevokedAt == null,
                        cancellationToken);

                if (oldAssignment != null)
                {
                    oldAssignment.RevokedAt = now;
                    oldAssignment.RevokedByUserId = currentUserId;
                    currentOwnerMember.RolesVersion = Guid.NewGuid();
                    if (currentOwnerMember.DisplayColorRoleId == ownerRole.Id)
                    {
                        currentOwnerMember.DisplayColorMode =
                            ServerMemberDisplayColorModeCodes.Auto;
                        currentOwnerMember.DisplayColorRoleId = null;
                    }
                }

                var newAssignment = await this._db.ServerMemberRoles
                    .FirstOrDefaultAsync(
                        x => x.ServerId == serverId &&
                             x.MemberId == targetMember.Id &&
                             x.RoleId == ownerRole.Id,
                        cancellationToken);

                if (newAssignment == null)
                {
                    this._db.ServerMemberRoles.Add(new ServerMemberRole
                    {
                        Id = Guid.NewGuid(),
                        ServerId = serverId,
                        MemberId = targetMember.Id,
                        RoleId = ownerRole.Id,
                        AssignedByUserId = currentUserId,
                        AssignedAt = now
                    });
                    targetMember.RolesVersion = Guid.NewGuid();
                }
                else
                {
                    newAssignment.RevokedAt = null;
                    newAssignment.RevokedByUserId = null;
                    targetMember.RolesVersion = Guid.NewGuid();
                }
            }

            this._db.ServerOwnershipTransfers.Add(transfer);
            this._access.AddAudit(
                serverId,
                ServerGovernanceIds.AuditOwnershipTransferred,
                currentUserId,
                targetMember.UserId,
                payload: $$"""{"fromUserId":"{{currentUserId}}","toUserId":"{{targetMember.UserId}}"}""");
            await this._db.StageServerAclRevisionBumpAsync(serverId, cancellationToken);
            await this._db.SaveChangesAsync(cancellationToken);
            this._spaceAuthorization.InvalidateServer(serverId);
            await this._voiceAccess.ReconcileServerBestEffortAsync(serverId);

            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerUpdated,
                new { serverId },
                CancellationToken.None);
            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerGovernanceChanged,
                new { serverId },
                CancellationToken.None);
            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerMembersChanged,
                new { serverId },
                CancellationToken.None);
            await this._realtime.NotifyServerBestEffortAsync(
                this._logger,
                serverId,
                RealtimeEventNames.ServerSpacesChanged,
                new { serverId },
                CancellationToken.None);

            return new ServerOwnershipTransferResponse
            {
                Id = transfer.Id,
                ServerId = transfer.ServerId,
                FromUserId = transfer.FromUserId,
                ToUserId = transfer.ToUserId,
                TransferTypeCode = "voluntary",
                Reason = transfer.Reason,
                ExecutedByUserId = transfer.ExecutedByUserId,
                TransferredAt = transfer.TransferredAt
            };
        }
    }
}
