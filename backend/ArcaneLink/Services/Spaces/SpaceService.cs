using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;

namespace ArcaneLink.Services.Spaces
{
    public class SpaceService : ISpaceService
    {
        private readonly ISpaceQueryService _queries;
        private readonly ISpaceCommandService _commands;
        private readonly ISpaceReorderService _reorder;
        private readonly ISpacePermissionOverrideService _permissionOverrides;

        public SpaceService(
            ISpaceQueryService queries,
            ISpaceCommandService commands,
            ISpaceReorderService reorder,
            ISpacePermissionOverrideService permissionOverrides)
        {
            this._queries = queries;
            this._commands = commands;
            this._reorder = reorder;
            this._permissionOverrides = permissionOverrides;
        }

        public Task<IReadOnlyList<SpaceTypeResponse>> GetSpaceTypesAsync(
            CancellationToken cancellationToken = default)
        {
            return this._queries.GetSpaceTypesAsync(cancellationToken);
        }

        public Task<IReadOnlyList<SpaceResponse>?> GetServerSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            return this._queries.GetServerSpacesAsync(currentUserId, serverId, cancellationToken);
        }

        public Task<SpaceResponse?> CreateSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            CreateSpaceRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._commands.CreateSpaceAsync(currentUserId, serverId, request, cancellationToken);
        }

        public Task<SpaceResponse?> UpdateSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            UpdateSpaceRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._commands.UpdateSpaceAsync(currentUserId, serverId, spaceId, request, cancellationToken);
        }

        public Task<bool> DeleteSpaceAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            DeleteSpaceRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._commands.DeleteSpaceAsync(currentUserId, serverId, spaceId, request, cancellationToken);
        }

        public Task<bool> ReorderSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            ReorderSpacesRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._reorder.ReorderSpacesAsync(currentUserId, serverId, request, cancellationToken);
        }

        public Task<SpacePermissionOverrideResponse?> UpsertPermissionOverrideAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            UpsertSpacePermissionOverrideRequest request,
            CancellationToken cancellationToken = default)
        {
            return this._permissionOverrides.UpsertPermissionOverrideAsync(
                currentUserId,
                serverId,
                spaceId,
                request,
                cancellationToken);
        }

        public Task<bool> DeletePermissionOverrideAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid overrideId,
            CancellationToken cancellationToken = default)
        {
            return this._permissionOverrides.DeletePermissionOverrideAsync(
                currentUserId,
                serverId,
                spaceId,
                overrideId,
                cancellationToken);
        }
    }
}
