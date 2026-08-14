using ArcaneLink.DataBase.Models.AssetsModels;

namespace ArcaneLink.Services.Assets.Abstractions
{
    public interface IAssetAccessPolicy
    {
        Task<AssetReadScope> GetReadScopeAsync(
            Guid? currentUserId,
            Asset asset,
            CancellationToken cancellationToken = default);
    }

    public enum AssetReadScope
    {
        Denied,
        Private,
        Public
    }
}
