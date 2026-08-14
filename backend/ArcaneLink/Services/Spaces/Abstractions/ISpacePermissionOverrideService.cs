using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.Spaces.Abstractions
{
    public interface ISpacePermissionOverrideService
    {
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
