namespace ArcaneLink.Services.Servers.Authorization;

public enum ServerAuthorizationRoleKind
{
    Everyone,
    Standard,
    Integration
}

public sealed record ServerAuthorizationRole(
    Guid Id,
    Guid ServerId,
    ServerAuthorizationRoleKind Kind,
    int Position,
    PermissionMask256 PermissionMask);

public sealed record ServerAuthorizationPrincipal(
    Guid ServerId,
    Guid MemberId,
    bool IsActiveMember,
    bool IsOwner,
    ServerAuthorizationRole EveryoneRole,
    IReadOnlyList<ServerAuthorizationRole> AssignedRoles);

public enum ServerPermissionOverrideTargetKind
{
    Role,
    Member
}

public sealed record ServerPermissionOverride(
    Guid ServerId,
    Guid TargetServerId,
    ServerPermissionOverrideTargetKind TargetKind,
    Guid TargetId,
    PermissionMask256 AllowMask,
    PermissionMask256 DenyMask,
    ServerRoleAuthority? ProtectionAuthority = null);

public sealed record ServerPermissionScope(
    Guid ServerId,
    Guid ResourceId,
    IReadOnlyList<ServerPermissionOverride> Overrides);

public sealed record ServerPermissionResource(
    Guid ServerId,
    IReadOnlyList<ServerPermissionScope> CategoryPath,
    ServerPermissionScope? Space);

public abstract record ServerAuthorizationTarget;

public sealed record ServerAuthorizationResourceTarget(
    ServerAuthorizationRole ProtectionRole)
    : ServerAuthorizationTarget;

public sealed record ServerAuthorizationAuthorityTarget(
    ServerRoleAuthority ProtectionAuthority)
    : ServerAuthorizationTarget;

public sealed record ServerAuthorizationSubjectTarget(
    ServerAuthorizationPrincipal Subject)
    : ServerAuthorizationTarget;

public sealed record ServerAuthorizationRequest(
    Guid ServerId,
    string PermissionCode,
    bool OwnerOnly,
    IReadOnlyList<string> DependencyCodes,
    ServerPermissionResource? PermissionResource = null,
    ServerAuthorizationTarget? Target = null);

public enum ServerRoleAuthorityTier
{
    Everyone,
    Standard,
    Administrator,
    Owner
}

public readonly record struct ServerRoleAuthority(
    Guid ServerId,
    ServerRoleAuthorityTier Tier,
    int Position)
{
    public static ServerRoleAuthority Everyone(Guid serverId) =>
        new(serverId, ServerRoleAuthorityTier.Everyone, int.MaxValue);

    public static ServerRoleAuthority Standard(Guid serverId, int position) =>
        new(serverId, ServerRoleAuthorityTier.Standard, position);

    public static ServerRoleAuthority Administrator(Guid serverId, int position) =>
        new(serverId, ServerRoleAuthorityTier.Administrator, position);

    public static ServerRoleAuthority Owner(Guid serverId) =>
        new(serverId, ServerRoleAuthorityTier.Owner, 0);
}
