using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.ServerExceptions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Servers;

public class ServerConfigurationValidator
{
    private readonly AppDbContext _db;

    public ServerConfigurationValidator(AppDbContext db)
    {
        this._db = db;
    }

    public void NormalizeIconCrop(
        ref double cropOffsetX,
        ref double cropOffsetY,
        ref double cropZoom)
    {
        cropOffsetX = Math.Clamp(cropOffsetX, -1, 1);
        cropOffsetY = Math.Clamp(cropOffsetY, -1, 1);
        cropZoom = Math.Clamp(cropZoom, 0.5, 3);
    }

    public string NormalizeAccessMode(string? accessMode)
    {
        var normalized = accessMode?.Trim().ToLowerInvariant();
        if (normalized == null ||
            !ServerAccessModeCodes.All.Contains(normalized))
        {
            throw new InvalidServerDataException(
                ExceptionMessages.ServerAccessModeIsInvalid);
        }

        return normalized;
    }

    public async Task EnsureIconAssetAsync(
        Guid currentUserId,
        Guid? iconAssetId,
        CancellationToken cancellationToken = default)
    {
        if (iconAssetId == null)
        {
            return;
        }

        var isValidIcon = await this._db.Assets
            .AnyAsync(
                x => x.Id == iconAssetId.Value &&
                     x.OwnerUserId == currentUserId &&
                     x.AssetTypeId == AssetTypeIds.ServerIcon &&
                     x.DeletedAt == null,
                cancellationToken);

        if (!isValidIcon)
        {
            throw new InvalidServerDataException(
                ExceptionMessages.ServerIconAssetIsInvalid);
        }
    }

    public async Task EnsureDefaultTextSpaceAsync(
        Guid serverId,
        Guid spaceId,
        CancellationToken cancellationToken = default)
    {
        var isValidTextSpace = await this._db.Spaces
            .AnyAsync(
                x => x.Id == spaceId &&
                     x.ServerId == serverId &&
                     x.TypeId == SpaceIds.TypeTextRoom &&
                     x.DeletedAt == null,
                cancellationToken);

        if (!isValidTextSpace)
        {
            throw new InvalidServerDataException(
                "Default text space must be an active text space on this server.");
        }
    }
}
