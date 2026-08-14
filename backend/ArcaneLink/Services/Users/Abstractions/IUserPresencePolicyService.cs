namespace ArcaneLink.Services.Users.Abstractions
{
    public interface IUserPresencePolicyService
    {
        Task<IReadOnlyDictionary<Guid, UserPresenceSnapshot>> ResolveAsync(
            Guid? viewerUserId,
            IEnumerable<Guid> targetUserIds,
            CancellationToken cancellationToken = default);
    }
}
