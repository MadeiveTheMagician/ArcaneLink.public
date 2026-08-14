using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.PrivateSpaces.Abstractions
{
    public interface IPrivateSpaceService
    {
        Task<IReadOnlyList<PrivateSpaceResponse>> GetMyPrivateSpacesAsync(
            Guid currentUserId,
            CancellationToken cancellationToken = default);

        Task<PrivateSpaceResponse?> GetPrivateSpaceAsync(
            Guid currentUserId,
            Guid spaceId,
            CancellationToken cancellationToken = default);

        Task<PrivateSpaceResponse?> CreatePrivateSpaceAsync(
            Guid currentUserId,
            CreatePrivateSpaceRequest request,
            CancellationToken cancellationToken = default);

        Task<PrivateSpaceResponse?> GetOrCreateDirectSpaceAsync(
            Guid currentUserId,
            Guid targetUserId,
            CancellationToken cancellationToken = default);

        Task<PrivateSpaceResponse?> UpdatePersonalSettingsAsync(
            Guid currentUserId,
            Guid spaceId,
            UpdatePrivateSpacePersonalSettingsRequest request,
            CancellationToken cancellationToken = default);

        Task<PrivateSpaceResponse?> UpdateGroupSettingsAsync(
            Guid currentUserId,
            Guid spaceId,
            UpdateGroupPrivateSpaceRequest request,
            CancellationToken cancellationToken = default);

    }
}
