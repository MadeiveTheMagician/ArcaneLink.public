namespace ArcaneLink.Services.Servers.Authorization
{
    public sealed record ServerAuthorizationContext(
        Guid AuthorizationVersion,
        ServerAuthorizationPrincipal Principal);

    public sealed record ServerAuthorizationRequirement(
        string PermissionCode,
        bool OwnerOnly = false,
        IReadOnlyList<string>? DependencyCodes = null);
}
