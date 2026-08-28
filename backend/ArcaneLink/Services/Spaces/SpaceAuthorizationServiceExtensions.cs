using ArcaneLink.Services.Spaces.Abstractions;

namespace ArcaneLink.Services.Spaces;

public static class SpaceAuthorizationServiceExtensions
{
    public static async Task<IReadOnlyDictionary<Guid, SpaceAuthorizationSnapshot>>
        GetSnapshotsAsync(
            this ISpaceAuthorizationService authorization,
            Guid userId,
            IEnumerable<Guid> serverIds,
            CancellationToken cancellationToken = default)
    {
        var snapshots = new Dictionary<Guid, SpaceAuthorizationSnapshot>();
        foreach (var serverId in serverIds.Distinct())
        {
            var snapshot = await authorization.GetSnapshotAsync(
                userId,
                serverId,
                cancellationToken);
            if (snapshot != null)
            {
                snapshots[serverId] = snapshot;
            }
        }

        return snapshots;
    }
}
