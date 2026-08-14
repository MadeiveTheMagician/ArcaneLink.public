using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.Spaces.Abstractions
{
    public interface ISpaceQueryService
    {
        Task<IReadOnlyList<SpaceTypeResponse>> GetSpaceTypesAsync(CancellationToken cancellationToken = default);

        Task<IReadOnlyList<SpaceResponse>?> GetServerSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default);

        Task<SpaceResponse?> GetSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken = default);
    }
}
