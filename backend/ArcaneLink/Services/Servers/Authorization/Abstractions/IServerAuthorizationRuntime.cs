namespace ArcaneLink.Services.Servers.Authorization.Abstractions;

public interface IServerAuthorizationRuntime
{
    Task<ServerAuthorizationContext?> GetContextAsync(
        Guid userId,
        Guid serverId,
        CancellationToken cancellationToken = default);

    Task<bool> IsAllowedAsync(
        Guid userId,
        Guid serverId,
        ServerAuthorizationRequirement requirement,
        CancellationToken cancellationToken = default);
}
