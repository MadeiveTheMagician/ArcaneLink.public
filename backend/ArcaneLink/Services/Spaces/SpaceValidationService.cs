using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Spaces
{
    public class SpaceValidationService
    {
        private readonly AppDbContext _db;

        public SpaceValidationService(AppDbContext db)
        {
            this._db = db;
        }

        public async Task<bool> IsValidHierarchyAsync(
            Guid serverId,
            Guid typeId,
            Guid? parentSpaceId,
            CancellationToken cancellationToken,
            Guid? movingSpaceId = null)
        {
            if (parentSpaceId == null)
            {
                return true;
            }

            var spaces = await this._db.Spaces
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    x.ParentVoiceSpaceId == null &&
                    x.DeletedAt == null)
                .ToListAsync(cancellationToken);
            var space = new ArcaneLink.DataBase.Models.SpacesModels.Space
            {
                Id = movingSpaceId ?? Guid.Empty,
                ServerId = serverId,
                TypeId = typeId,
                Title = string.Empty
            };

            return SpaceTreeUtility.IsValidHierarchy(
                space,
                parentSpaceId,
                spaces,
                movingSpaceId);
        }

        public async Task<bool> IsValidRequiredRoleAsync(
            Guid serverId,
            Guid? roleId,
            CancellationToken cancellationToken)
        {
            return roleId == null ||
                   await this._db.ServerRoles.AnyAsync(
                       x => x.Id == roleId &&
                            x.ServerId == serverId &&
                            x.DeletedAt == null,
                       cancellationToken);
        }

        public async Task<bool> IsValidOverrideRoleAsync(
            Guid serverId,
            Guid? roleId,
            CancellationToken cancellationToken)
        {
            return roleId == null ||
                   await this._db.ServerRoles.AnyAsync(
                       x => x.Id == roleId &&
                            x.ServerId == serverId &&
                            x.DeletedAt == null,
                       cancellationToken);
        }

        public async Task<bool> IsValidOverrideMemberAsync(
            Guid serverId,
            Guid? memberId,
            CancellationToken cancellationToken)
        {
            return memberId == null ||
                   await this._db.ServerMembers.AnyAsync(
                       x => x.Id == memberId &&
                            x.ServerId == serverId &&
                            x.StatusId == ServerMemberStatusIds.Active,
                       cancellationToken);
        }

        public async Task<bool> SpaceExistsAsync(
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            return await this._db.Spaces.AnyAsync(
                x => x.Id == spaceId &&
                     x.ServerId == serverId &&
                     x.ParentVoiceSpaceId == null &&
                     x.DeletedAt == null,
                cancellationToken);
        }

        public async Task<bool> PermissionExistsAsync(
            Guid permissionId,
            CancellationToken cancellationToken)
        {
            if (!SpacePermissionIds.Contains(permissionId))
            {
                return false;
            }

            return await this._db.PermissionCatalog.AnyAsync(
                x => x.Id == permissionId,
                cancellationToken);
        }

        public static bool IsValidOverrideTarget(UpsertSpacePermissionOverrideRequest request)
        {
            return request.RoleId.HasValue != request.MemberId.HasValue;
        }
    }
}
