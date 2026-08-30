using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Assets.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Assets;

/// <summary>
/// Deletes generated current-avatar assets only after every supported
/// profile surface has released them. Source assets from the avatar
/// library are deliberately never handled by this helper.
/// </summary>
public static class OptimizedAvatarAssetCleanup
{
    public static async Task DeleteOwnedIfOrphanedAsync(
        AppDbContext db,
        IAssetService assets,
        Guid ownerUserId,
        Guid assetId,
        CancellationToken cancellationToken = default)
    {
        var isOwnedOptimizedAvatar = await db.Assets
            .AsNoTracking()
            .AnyAsync(
                asset =>
                    asset.Id == assetId &&
                    asset.OwnerUserId == ownerUserId &&
                    asset.AssetTypeId == AssetTypeIds.CurrentAvatar &&
                    asset.DeletedAt == null,
                cancellationToken);
        if (!isOwnedOptimizedAvatar ||
            await IsReferencedAsync(db, assetId, cancellationToken))
        {
            return;
        }

        await assets.DeleteOwnedAssetAsync(
            ownerUserId,
            assetId,
            cancellationToken);
    }

    private static async Task<bool> IsReferencedAsync(
        AppDbContext db,
        Guid assetId,
        CancellationToken cancellationToken)
    {
        return
            await db.UserProfiles.AsNoTracking().AnyAsync(
                profile =>
                    profile.AvatarAssetId == assetId ||
                    profile.AvatarSourceAssetId == assetId,
                cancellationToken) ||
            await db.ServerMemberProfiles.AsNoTracking().AnyAsync(
                profile =>
                    profile.AvatarAssetId == assetId ||
                    profile.AvatarSourceAssetId == assetId,
                cancellationToken) ||
            await db.PrivateSpaceMembers.AsNoTracking().AnyAsync(
                member => member.PeerAvatarAssetId == assetId,
                cancellationToken) ||
            await db.PrivateSpaces.AsNoTracking().AnyAsync(
                space => space.AvatarAssetId == assetId,
                cancellationToken) ||
            await db.Servers.AsNoTracking().AnyAsync(
                server => server.IconAssetId == assetId,
                cancellationToken);
    }
}
