using ArcaneLink.DataBase.DTOs.Servers;

namespace ArcaneLink.Services.Servers.Abstractions;

public interface IServerRoleService
{
    Task<IReadOnlyList<PermissionResponse>> GetPermissionsAsync(CancellationToken cancellationToken = default);
    Task<ServerPermissionCatalogResponse> GetPermissionCatalogV1Async(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PermissionResponse>> GetSpacePermissionsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServerRoleResponse>?> GetRolesAsync(Guid currentUserId, Guid serverId, ServerRoleQueryRequest query, CancellationToken cancellationToken = default);
    Task<CreateServerRoleResult> CreateRoleAsync(Guid currentUserId, Guid serverId, CreateServerRoleRequest request, CancellationToken cancellationToken = default);
    Task<UpdateServerRoleResult> UpdateRoleAsync(Guid currentUserId, Guid serverId, Guid roleId, UpdateServerRoleRequest request, CancellationToken cancellationToken = default);
    Task<UpdateServerRoleResult> UpdateRolePermissionsAsync(Guid currentUserId, Guid serverId, Guid roleId, UpdateServerRolePermissionsRequest request, CancellationToken cancellationToken = default);
    Task<DuplicateServerRoleResult> DuplicateRoleAsync(Guid currentUserId, Guid serverId, Guid roleId, DuplicateServerRoleRequest request, CancellationToken cancellationToken = default);
    Task<ServerRoleDeletionImpactResponse?> GetDeletionImpactAsync(Guid currentUserId, Guid serverId, Guid roleId, CancellationToken cancellationToken = default);
    Task<DeleteServerRoleResult> DeleteRoleAsync(Guid currentUserId, Guid serverId, Guid roleId, Guid expectedVersion, CancellationToken cancellationToken = default);
    Task<ReorderServerRolesResult> ReorderRolesAsync(Guid currentUserId, Guid serverId, ReorderServerRolesRequest request, CancellationToken cancellationToken = default);
    Task<ServerMemberRoleResponse?> AssignRoleAsync(Guid currentUserId, Guid serverId, Guid memberId, AssignServerRoleRequest request, CancellationToken cancellationToken = default);
    Task<bool> RevokeMemberRoleAsync(Guid currentUserId, Guid serverId, Guid memberRoleId, CancellationToken cancellationToken = default);
}

public enum UpdateServerRoleStatus
{
    Success,
    InvalidRequest,
    NotFound,
    Conflict,
    TitleConflict
}

public enum CreateServerRoleStatus
{
    Success,
    InvalidRequest,
    NotFound,
    Conflict,
    TitleConflict
}

public sealed record CreateServerRoleResult(
    CreateServerRoleStatus Status,
    ServerRoleResponse? Role = null)
{
    public static CreateServerRoleResult Success(ServerRoleResponse response) =>
        new(CreateServerRoleStatus.Success, response);

    public static CreateServerRoleResult InvalidRequest() =>
        new(CreateServerRoleStatus.InvalidRequest);

    public static CreateServerRoleResult NotFound() =>
        new(CreateServerRoleStatus.NotFound);

    public static CreateServerRoleResult Conflict() =>
        new(CreateServerRoleStatus.Conflict);

    public static CreateServerRoleResult TitleConflict() =>
        new(CreateServerRoleStatus.TitleConflict);
}

public sealed record UpdateServerRoleResult(
    UpdateServerRoleStatus Status,
    ServerRoleResponse? Role = null)
{
    public static UpdateServerRoleResult Success(ServerRoleResponse response) =>
        new(UpdateServerRoleStatus.Success, response);

    public static UpdateServerRoleResult InvalidRequest() =>
        new(UpdateServerRoleStatus.InvalidRequest);

    public static UpdateServerRoleResult NotFound() =>
        new(UpdateServerRoleStatus.NotFound);

    public static UpdateServerRoleResult Conflict() =>
        new(UpdateServerRoleStatus.Conflict);

    public static UpdateServerRoleResult TitleConflict() =>
        new(UpdateServerRoleStatus.TitleConflict);
}

public enum DuplicateServerRoleStatus
{
    Success,
    InvalidRequest,
    NotFound,
    Conflict,
    TitleConflict,
    AdministratorConfirmationRequired
}

public sealed record DuplicateServerRoleResult(
    DuplicateServerRoleStatus Status,
    ServerRoleResponse? Role = null)
{
    public static DuplicateServerRoleResult Success(ServerRoleResponse response) =>
        new(DuplicateServerRoleStatus.Success, response);

    public static DuplicateServerRoleResult InvalidRequest() =>
        new(DuplicateServerRoleStatus.InvalidRequest);

    public static DuplicateServerRoleResult NotFound() =>
        new(DuplicateServerRoleStatus.NotFound);

    public static DuplicateServerRoleResult Conflict() =>
        new(DuplicateServerRoleStatus.Conflict);

    public static DuplicateServerRoleResult TitleConflict() =>
        new(DuplicateServerRoleStatus.TitleConflict);

    public static DuplicateServerRoleResult AdministratorConfirmationRequired() =>
        new(DuplicateServerRoleStatus.AdministratorConfirmationRequired);
}

public enum DeleteServerRoleStatus
{
    Success,
    InvalidRequest,
    NotFound,
    Conflict,
    HasDependencies
}

public sealed record DeleteServerRoleResult(
    DeleteServerRoleStatus Status,
    ServerRoleDeletionImpactResponse? Impact = null)
{
    public static DeleteServerRoleResult Success() =>
        new(DeleteServerRoleStatus.Success);

    public static DeleteServerRoleResult InvalidRequest() =>
        new(DeleteServerRoleStatus.InvalidRequest);

    public static DeleteServerRoleResult NotFound() =>
        new(DeleteServerRoleStatus.NotFound);

    public static DeleteServerRoleResult Conflict() =>
        new(DeleteServerRoleStatus.Conflict);

    public static DeleteServerRoleResult HasDependencies(
        ServerRoleDeletionImpactResponse impact) =>
        new(DeleteServerRoleStatus.HasDependencies, impact);
}

public enum ReorderServerRolesStatus
{
    Success,
    InvalidRequest,
    NotFound,
    Conflict
}

public sealed record ReorderServerRolesResult(ReorderServerRolesStatus Status)
{
    public static ReorderServerRolesResult Success() =>
        new(ReorderServerRolesStatus.Success);

    public static ReorderServerRolesResult InvalidRequest() =>
        new(ReorderServerRolesStatus.InvalidRequest);

    public static ReorderServerRolesResult NotFound() =>
        new(ReorderServerRolesStatus.NotFound);

    public static ReorderServerRolesResult Conflict() =>
        new(ReorderServerRolesStatus.Conflict);
}
