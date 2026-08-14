using ArcaneLink.DataBase.DTOs.Spaces;

namespace ArcaneLink.Services.Spaces.Abstractions
{
    public interface ISpaceReorderService
    {
        Task<bool> ReorderSpacesAsync(
            Guid currentUserId,
            Guid serverId,
            ReorderSpacesRequest request,
            CancellationToken cancellationToken = default);
    }
}
