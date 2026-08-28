using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions;

public interface IUserProfileTagService
{
    Task<IReadOnlyList<ProfileTagResponse>> GetProfileTagsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfileTagResponse>> GetUserProfileTagsAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfileTagResponse>?> UpdateUserProfileTagsAsync(
        Guid userId,
        UpdateUserProfileTagsRequest request,
        CancellationToken cancellationToken = default);

    Task ReplaceUserProfileTagsAsync(
        Guid userId,
        IEnumerable<Guid> tagIds,
        CancellationToken cancellationToken = default);
}
