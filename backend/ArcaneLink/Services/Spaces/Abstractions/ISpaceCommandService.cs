using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.Spaces.Abstractions;

public interface ISpaceCommandService
{
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
}
