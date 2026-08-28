using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Services.Servers;

internal static class ServerGovernanceMapper
{
    private static readonly LegacyServerPermissionMaskAdapter LegacyPermissionAdapter =
        new();

    public static ServerInviteResponse ToInviteResponse(
        ServerInvite invite,
        DateTime now,
        int memberCount = 0,
        int onlineCount = 0) => new()
        {
            Id = invite.Id,
            ServerId = invite.ServerId,
            ServerTitle = invite.Server?.Title,
            ServerDescription = invite.Server?.Description,
            ServerIconAssetId = invite.Server?.IconAssetId,
            ServerIconCropOffsetX = invite.Server?.IconCropOffsetX ?? 0,
            ServerIconCropOffsetY = invite.Server?.IconCropOffsetY ?? 0,
            ServerIconCropZoom = invite.Server?.IconCropZoom ?? 1,
            MemberCount = memberCount,
            OnlineCount = onlineCount,
            KindCode = invite.Kind.Code,
            Code = invite.Code,
            TargetUserId = invite.TargetUserId,
            MaxUses = invite.MaxUses,
            UsedCount = invite.UsedCount,
            ExpiresAt = invite.ExpiresAt,
            CreatedAt = invite.CreatedAt,
            RevokedAt = invite.RevokedAt,
            IsActive = ServerInviteRules.IsActive(invite, now)
        };

    public static ServerRoleResponse ToRoleResponse(
        ServerRole role,
        int directAssignmentCount = 0) => new()
        {
            Id = role.Id,
            ServerId = role.ServerId,
            Code = role.Code,
            Title = role.Title,
            Description = role.Description,
            Kind = role.Kind,
            Color = role.Color,
            Mentionable = role.Mentionable,
            CreatedByUserId = role.CreatedByUserId,
            Level = role.Level,
            IsSystem = role.IsSystem,
            Version = role.Version,
            DirectAssignmentCount = directAssignmentCount,
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            PermissionCodes = GetPermissionCodes(role),
            Permissions = role.Permissions
            .Where(x =>
                x.IsGranted &&
                ServerGovernanceIds.ServerPermissionIds.Contains(
                    x.PermissionId))
            .Select(x => new PermissionResponse
            {
                Id = x.Permission.Id,
                Code = x.Permission.Code,
                Title = x.Permission.Title,
                Description = x.Permission.Description
            })
            .ToList(),
            CreatedAt = role.CreatedAt,
            UpdatedAt = role.UpdatedAt
        };

    private static IReadOnlyList<string> GetPermissionCodes(ServerRole role)
    {
        return ServerRolePermissionMaskResolver.TryResolve(
            role,
            LegacyPermissionAdapter,
            out var permissionMask,
            out _)
            ? ServerPermissionRegistry.GetCodes(permissionMask)
            : [];
    }

    public static ServerMemberRoleResponse ToMemberRoleResponse(ServerMemberRole assignment, string roleTitle) => new()
    {
        Id = assignment.Id,
        ServerId = assignment.ServerId,
        MemberId = assignment.MemberId,
        RoleId = assignment.RoleId,
        RoleTitle = roleTitle,
        AssignedAt = assignment.AssignedAt,
        RevokedAt = assignment.RevokedAt
    };

    public static ServerMemberResponse ToServerMemberResponse(ServerMember member) => new()
    {
        Id = member.Id,
        ServerId = member.ServerId,
        UserId = member.UserId,
        StatusCode = member.Status.Code,
        JoinedAt = member.JoinedAt,
        LeftAt = member.LeftAt,
        AddedByUserId = member.AddedByUserId,
        CreatedAt = member.CreatedAt,
        UpdatedAt = member.UpdatedAt,
        Server = new ServerResponse
        {
            Id = member.Server.Id,
            CreatedByUserId = member.Server.CreatedByUserId,
            OwnerUserId = member.Server.OwnerUserId,
            Slug = member.Server.Slug,
            Title = member.Server.Title,
            Description = member.Server.Description,
            IconAssetId = member.Server.IconAssetId,
            IconCropOffsetX = member.Server.IconCropOffsetX,
            IconCropOffsetY = member.Server.IconCropOffsetY,
            IconCropZoom = member.Server.IconCropZoom,
            AccessMode = member.Server.AccessMode,
            IsSystem = member.Server.IsSystem,
            CreatedAt = member.Server.CreatedAt,
            UpdatedAt = member.Server.UpdatedAt
        }
    };
}
