using Microsoft.Extensions.Caching.Memory;

namespace ArcaneLink.Services.Servers.Authorization;

public sealed class ServerAuthorizationContextCache : IDisposable
{
    // Versioned keys make stale contexts unreachable. Old revisions are
    // deliberately reclaimed by bounded TTL/size eviction so correctness
    // never depends on an in-process invalidation callback.
    private const long MaxCachedContexts = 100_000;
    private static readonly TimeSpan SlidingExpiration =
        TimeSpan.FromMinutes(10);
    private static readonly TimeSpan AbsoluteExpiration =
        TimeSpan.FromMinutes(30);
    private readonly MemoryCache _cache = new(new MemoryCacheOptions
    {
        SizeLimit = MaxCachedContexts
    });

    public bool TryGet(
        Guid serverId,
        Guid memberId,
        Guid authorizationVersion,
        out ServerAuthorizationContext context)
    {
        if (this._cache.TryGetValue(
                new ContextCacheKey(
                    serverId,
                    memberId,
                    authorizationVersion),
                out ServerAuthorizationContext? cached) &&
            cached is not null)
        {
            context = cached;
            return true;
        }

        context = null!;
        return false;
    }

    public void Set(ServerAuthorizationContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        this._cache.Set(
            new ContextCacheKey(
                context.Principal.ServerId,
                context.Principal.MemberId,
                context.AuthorizationVersion),
            context,
            new MemoryCacheEntryOptions
            {
                Size = 1,
                SlidingExpiration = SlidingExpiration,
                AbsoluteExpirationRelativeToNow = AbsoluteExpiration
            });
    }

    public void Dispose()
    {
        this._cache.Dispose();
    }

    private readonly record struct ContextCacheKey(
        Guid ServerId,
        Guid MemberId,
        Guid AuthorizationVersion);
}
