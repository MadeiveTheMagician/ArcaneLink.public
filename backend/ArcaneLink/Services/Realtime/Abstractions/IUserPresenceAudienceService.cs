namespace ArcaneLink.Services.Realtime.Abstractions;

public interface IUserPresenceAudienceService
{
    Task<UserPresenceAudienceSnapshot> ResolveAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
