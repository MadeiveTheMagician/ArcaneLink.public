namespace ArcaneLink.Services.Spaces.Abstractions;

public interface ISpaceAuthorizationService
{
    Task<SpaceAuthorizationSnapshot?> GetSnapshotAsync(
        Guid userId,
        Guid serverId,
        CancellationToken cancellationToken = default);

    Task<SpaceAccessCapabilities?> GetCapabilitiesAsync(
        Guid userId,
        Guid serverId,
        Guid spaceId,
        CancellationToken cancellationToken = default);

    Task<bool> IsAllowedAsync(
        Guid userId,
        Guid serverId,
        Guid spaceId,
        SpaceAuthorizationRequirement requirement,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(false);
    }

    Task<SpaceAccessCapabilities?> GetGranularCapabilitiesAsync(
        Guid userId,
        Guid serverId,
        Guid spaceId,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<SpaceAccessCapabilities?>(null);
    }

    Task<IReadOnlyList<Guid>?> GetAllowedSpaceIdsAsync(
        Guid userId,
        Guid serverId,
        SpaceAction action,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Guid>> FilterAuthorizedUserIdsAsync(
        Guid serverId,
        Guid spaceId,
        IEnumerable<Guid> userIds,
        SpaceAction action,
        CancellationToken cancellationToken = default);

    void InvalidateServer(Guid serverId);
}
