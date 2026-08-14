using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Messages;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Assets
{
    public sealed class AssetAccessPolicy : IAssetAccessPolicy
    {
        private readonly AppDbContext _db;
        private readonly SpaceMessageAccessService _messageAccess;

        public AssetAccessPolicy(
            AppDbContext db,
            SpaceMessageAccessService messageAccess)
        {
            _db = db;
            _messageAccess = messageAccess;
        }

        public async Task<AssetReadScope> GetReadScopeAsync(
            Guid? currentUserId,
            Asset asset,
            CancellationToken cancellationToken = default)
        {
            if (asset.AssetTypeId == AssetTypeIds.Avatar)
            {
                var isLegacyPublicAvatar =
                    await _db.UserProfiles
                        .AsNoTracking()
                        .AnyAsync(
                            profile => profile.AvatarAssetId == asset.Id,
                            cancellationToken) ||
                    await _db.ServerMemberProfiles
                        .AsNoTracking()
                        .AnyAsync(
                            profile => profile.AvatarAssetId == asset.Id,
                            cancellationToken);

                if (isLegacyPublicAvatar)
                {
                    return AssetReadScope.Public;
                }

                return currentUserId.HasValue &&
                       asset.OwnerUserId == currentUserId.Value
                    ? AssetReadScope.Private
                    : AssetReadScope.Denied;
            }

            if (asset.AssetTypeId != AssetTypeIds.MessageAttachment)
            {
                return AssetReadScope.Public;
            }

            if (!currentUserId.HasValue)
            {
                return AssetReadScope.Denied;
            }

            var liveLinks = await _db.SpaceMessageAssets
                .AsNoTracking()
                .Where(link =>
                    link.AssetId == asset.Id &&
                    link.Message.DeletedAt == null &&
                    link.Message.Space.DeletedAt == null &&
                    ((link.Message.Space.ServerId != null &&
                      link.Message.Space.Server != null &&
                      link.Message.Space.Server.DeletedAt == null) ||
                     (link.Message.Space.PrivateSpace != null &&
                      link.Message.Space.PrivateSpace.DeletedAt == null)))
                .Select(link => new AssetMessageLink(
                    link.Message.SpaceId,
                    link.Message.Space.ServerId,
                    link.Message.Space.PrivateSpace != null))
                .Distinct()
                .ToListAsync(cancellationToken);

            if (liveLinks.Count == 0)
            {
                return asset.OwnerUserId == currentUserId.Value
                    ? AssetReadScope.Private
                    : AssetReadScope.Denied;
            }

            var privateSpaceIds = liveLinks
                .Where(link => link.IsPrivate)
                .Select(link => link.SpaceId)
                .Distinct()
                .ToList();
            if (privateSpaceIds.Count > 0 &&
                await _db.PrivateSpaceMembers
                    .AsNoTracking()
                    .AnyAsync(
                        member =>
                            privateSpaceIds.Contains(member.SpaceId) &&
                            member.UserId == currentUserId.Value &&
                            member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                            member.PrivateSpace.DeletedAt == null,
                        cancellationToken))
            {
                return AssetReadScope.Private;
            }

            foreach (var serverLink in liveLinks.Where(link =>
                         !link.IsPrivate &&
                         link.ServerId.HasValue))
            {
                if (await _messageAccess.GetReadableMessageSpaceAsync(
                        currentUserId.Value,
                        serverLink.ServerId!.Value,
                        serverLink.SpaceId,
                        cancellationToken) != null)
                {
                    return AssetReadScope.Private;
                }
            }

            return AssetReadScope.Denied;
        }

        private sealed record AssetMessageLink(
            Guid SpaceId,
            Guid? ServerId,
            bool IsPrivate);
    }
}
