using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.Spaces.Abstractions
{
    public interface ISpaceService
    {
        Task<IReadOnlyList<SpaceTypeResponse>> GetSpaceTypesAsync(CancellationToken cancellationToken = default);

        Task<IReadOnlyList<SpaceResponse>?> GetServerSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default);

        Task<SpaceResponse?> CreateSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            CreateSpaceRequest request,
            CancellationToken cancellationToken = default);

        Task<SpaceResponse?> UpdateSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            UpdateSpaceRequest request,
            CancellationToken cancellationToken = default);

        Task<bool> DeleteSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            DeleteSpaceRequest request,
            CancellationToken cancellationToken = default);

        Task<bool> ReorderSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            ReorderSpacesRequest request,
            CancellationToken cancellationToken = default);

        Task<SpacePermissionOverrideResponse?> UpsertPermissionOverrideAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            UpsertSpacePermissionOverrideRequest request,
            CancellationToken cancellationToken = default);

        Task<bool> DeletePermissionOverrideAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid overrideId,
            CancellationToken cancellationToken = default);
    }
}
