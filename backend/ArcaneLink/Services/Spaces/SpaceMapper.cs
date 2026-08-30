using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.SpacesModels;

namespace ArcaneLink.Services.Spaces;

internal static class SpaceMapper
{
    public static SpaceResponse ToSpaceResponse(
        Space space,
        SpaceAccessCapabilities capabilities,
        long unreadCount = 0)
    {
        return new SpaceResponse
        {
            Id = space.Id,
            ServerId = space.ServerId,
            TypeId = space.TypeId,
            TypeCode = space.Type.Code,
            ParentSpaceId = space.ParentSpaceId,
            VoiceChatSpaceId = space.VoiceChatSpace is { DeletedAt: null } voiceChatSpace
                ? voiceChatSpace.Id
                : null,
            CreatedByUserId = space.CreatedByUserId,
            Title = space.Title,
            Description = space.Description,
            RequiredServerRoleId = space.RequiredServerRoleId,
            Position = space.Position,
            IsSystem = space.IsSystem,
            CreatedAt = space.CreatedAt,
            UpdatedAt = space.UpdatedAt,
            DeletedAt = space.DeletedAt,
            UnreadCount = unreadCount,
            EffectiveCapabilities = new SpaceEffectiveCapabilitiesResponse
            {
                CanSendMessages = capabilities.CanSendMessages,
                CanConnectVoice = capabilities.CanConnectVoice,
                CanManageSpace = capabilities.CanManage,
                CanManageSpaceAccess = capabilities.CanManageSpaceAccess
            },
            PermissionOverrides = capabilities.CanManageSpaceAccess
                ? space.PermissionOverrides
                    .Select(ToOverrideResponse)
                    .ToList()
                : []
        };
    }

    public static SpacePermissionOverrideResponse ToOverrideResponse(
        SpacePermissionOverride permissionOverride)
    {
        return new SpacePermissionOverrideResponse
        {
            Id = permissionOverride.Id,
            SpaceId = permissionOverride.SpaceId,
            RoleId = permissionOverride.RoleId,
            MemberId = permissionOverride.MemberId,
            PermissionId = permissionOverride.PermissionId,
            PermissionCode = permissionOverride.Permission.Code,
            Allow = permissionOverride.Allow,
            Deny = permissionOverride.Deny,
            CreatedAt = permissionOverride.CreatedAt
        };
    }
}
