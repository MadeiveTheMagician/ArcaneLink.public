namespace ArcaneLink.DataBase.DTOs.Servers
{
    using System.ComponentModel.DataAnnotations;
    using ArcaneLink.DataBase.Constants;

    public class CreateServerInviteRequest
    {
        public string KindCode { get; set; } = "link";
        public Guid? TargetUserId { get; set; }
        public int? MaxUses { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    public class AcceptServerInviteRequest
    {
        public required string Code { get; set; }
    }

    public class ServerInviteResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public string? ServerTitle { get; set; }
        public string? ServerDescription { get; set; }
        public Guid? ServerIconAssetId { get; set; }
        public double ServerIconCropOffsetX { get; set; }
        public double ServerIconCropOffsetY { get; set; }
        public double ServerIconCropZoom { get; set; } = 1;
        public int MemberCount { get; set; }
        public int OnlineCount { get; set; }
        public string KindCode { get; set; } = "";
        public string? Code { get; set; }
        public Guid? TargetUserId { get; set; }
        public int? MaxUses { get; set; }
        public int UsedCount { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        public bool IsActive { get; set; }
    }

    public class ServerInvitePreviewResponse
    {
        public string Code { get; set; } = "";
        public bool IsActive { get; set; }
        public string? InvalidReason { get; set; }
        public Guid? ServerId { get; set; }
        public string? ServerTitle { get; set; }
        public Guid? ServerIconAssetId { get; set; }
        public double ServerIconCropOffsetX { get; set; }
        public double ServerIconCropOffsetY { get; set; }
        public double ServerIconCropZoom { get; set; } = 1;
        public int MemberCount { get; set; }
        public int OnlineCount { get; set; }
        public int? MaxUses { get; set; }
        public int UsedCount { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    public class TransferServerOwnershipRequest
    {
        public Guid ToMemberId { get; set; }
        public string? Reason { get; set; }
    }

    public class ServerOwnershipTransferResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public Guid FromUserId { get; set; }
        public Guid ToUserId { get; set; }
        public string TransferTypeCode { get; set; } = "";
        public string? Reason { get; set; }
        public Guid ExecutedByUserId { get; set; }
        public DateTime TransferredAt { get; set; }
    }

    public class CreateServerRoleRequest
    {
        [Required]
        [StringLength(64, MinimumLength = 1)]
        public required string Title { get; set; }

        [StringLength(255)]
        public string? Description { get; set; }

        [RegularExpression("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")]
        public string? Color { get; set; }

        public bool Mentionable { get; set; }
        public int? Level { get; set; }

        public int? PermissionSchemaVersion { get; set; }

        [Required]
        public IReadOnlyList<string> PermissionCodes { get; set; } = [];
    }

    public class UpdateServerRolePermissionsRequest
    {
        public int? PermissionSchemaVersion { get; set; }
        public IReadOnlyList<string> PermissionCodes { get; set; } = [];
        public Guid? ExpectedVersion { get; set; }
    }

    public class UpdateServerRoleRequest
    {
        [Required]
        [StringLength(64, MinimumLength = 1)]
        public required string Title { get; set; }

        [StringLength(255)]
        public string? Description { get; set; }

        [RegularExpression("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")]
        public string? Color { get; set; }

        public bool Mentionable { get; set; }

        public int? PermissionSchemaVersion { get; set; }

        [Required]
        public IReadOnlyList<string> PermissionCodes { get; set; } = [];

        public Guid ExpectedVersion { get; set; }
    }

    public class DuplicateServerRoleRequest
    {
        public Guid ExpectedVersion { get; set; }
        public bool ConfirmAdministrator { get; set; }
    }

    public sealed class ServerRoleDeletionImpactResponse
    {
        public Guid RoleId { get; set; }
        public Guid Version { get; set; }
        public int DirectAssignmentCount { get; set; }
        public int RoleAclCount { get; set; }
        public int ProtectedAclCount { get; set; }
        public int RequiredSpaceCount { get; set; }
        public int ProtectedSpaceCount { get; set; }
        public int CreatedWithRoleSpaceCount { get; set; }
        public int DisplayColorMemberCount { get; set; }
        public bool HasBlockingDependencies { get; set; }
        public bool CanDelete { get; set; }
    }

    public sealed class ReorderServerRoleItemRequest
    {
        public Guid RoleId { get; set; }
        public Guid ExpectedVersion { get; set; }
    }

    public sealed class ReorderServerRolesRequest
    {
        public Guid ExpectedAuthorizationVersion { get; set; }
        public IReadOnlyList<ReorderServerRoleItemRequest> Roles { get; set; } = [];
    }

    public class ServerRoleQueryRequest
    {
        [StringLength(100)]
        public string? Q { get; set; }

        [StringLength(100)]
        public string? PermissionCode { get; set; }
    }

    public class AssignServerRoleRequest
    {
        public Guid RoleId { get; set; }
    }

    public class PermissionResponse
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = "";
        public string Title { get; set; } = "";
        public string? Description { get; set; }
    }

    public sealed class ServerPermissionDefinitionResponse
    {
        public int Bit { get; set; }
        public string Code { get; set; } = "";
        public string Group { get; set; } = "";
        public string Title { get; set; } = "";
        public string? Description { get; set; }
    }

    public sealed class ServerPermissionCatalogResponse
    {
        public int PermissionSchemaVersion { get; set; }
        public IReadOnlyList<ServerPermissionDefinitionResponse> Permissions { get; set; } = [];
    }

    public class ServerRoleResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public string? Code { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public string Kind { get; set; } = ServerRoleKindCodes.Standard;
        public string? Color { get; set; }
        public bool Mentionable { get; set; }
        public Guid? CreatedByUserId { get; set; }
        public int Level { get; set; }
        public bool IsSystem { get; set; }
        public Guid Version { get; set; }
        public int DirectAssignmentCount { get; set; }
        public int PermissionSchemaVersion { get; set; }
        public IReadOnlyList<string> PermissionCodes { get; set; } = [];
        public IReadOnlyList<PermissionResponse> Permissions { get; set; } = [];
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class ServerMemberRoleResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public Guid MemberId { get; set; }
        public Guid RoleId { get; set; }
        public string RoleTitle { get; set; } = "";
        public DateTime AssignedAt { get; set; }
        public DateTime? RevokedAt { get; set; }
    }

    public class ServerAuditLogResponse
    {
        public Guid Id { get; set; }
        public Guid ServerId { get; set; }
        public string EventTypeCode { get; set; } = "";
        public string EventTitle { get; set; } = "";
        public Guid? ActorUserId { get; set; }
        public Guid? TargetUserId { get; set; }
        public Guid? RelatedRoleId { get; set; }
        public Guid? RelatedInviteId { get; set; }
        public Guid? RelatedSpaceId { get; set; }
        public string? Payload { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class BanServerMemberRequest
    {
        [Required]
        [StringLength(ServerBanLimits.ReasonMaxLength, MinimumLength = 1)]
        public required string Reason { get; set; }
    }

    public class ServerBanResponse
    {
        public Guid ServerId { get; set; }
        public Guid MemberId { get; set; }
        public Guid UserId { get; set; }
        public DateTime BannedAt { get; set; }
        public Guid? BannedByUserId { get; set; }
        public string Reason { get; set; } = "";
        public ServerMemberUserResponse User { get; set; } = null!;
    }
}
