using ArcaneLink.Services.Spaces;
using Microsoft.Extensions.Caching.Memory;

namespace ArcaneLink.Services.Realtime
{
    public sealed class ServerSpaceRealtimeAudienceCache : IDisposable
    {
        private const long MaxCachedRecipients = 1_000_000;
        private static readonly TimeSpan SlidingExpiration = TimeSpan.FromMinutes(10);
        private readonly MemoryCache _cache = new(new MemoryCacheOptions
        {
            SizeLimit = MaxCachedRecipients
        });

        public bool TryGet(
            Guid serverId,
            Guid spaceId,
            SpaceAction action,
            Guid revision,
            out IReadOnlyList<Guid> userIds)
        {
            if (this._cache.TryGetValue(
                    new AudienceCacheKey(serverId, spaceId, action, revision),
                    out Guid[]? cached) &&
                cached != null)
            {
                userIds = cached;
                return true;
            }

            userIds = [];
            return false;
        }

        public void Set(
            Guid serverId,
            Guid spaceId,
            SpaceAction action,
            Guid revision,
            IEnumerable<Guid> userIds)
        {
            var recipients = userIds.Distinct().ToArray();
            if (recipients.LongLength > MaxCachedRecipients)
            {
                return;
            }

            this._cache.Set(
                new AudienceCacheKey(serverId, spaceId, action, revision),
                recipients,
                new MemoryCacheEntryOptions
                {
                    Size = Math.Max(1, recipients.LongLength),
                    SlidingExpiration = SlidingExpiration
                });
        }

        public void Dispose()
        {
            this._cache.Dispose();
        }

        private sealed record AudienceCacheKey(
            Guid ServerId,
            Guid SpaceId,
            SpaceAction Action,
            Guid Revision);
    }
}
