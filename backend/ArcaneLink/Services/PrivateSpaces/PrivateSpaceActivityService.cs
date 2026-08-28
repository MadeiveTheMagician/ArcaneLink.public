using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces
{
    public sealed class PrivateSpaceActivityService
    {
        private readonly AppDbContext _db;

        public PrivateSpaceActivityService(AppDbContext db)
        {
            this._db = db;
        }

        internal async Task TouchAsync(
            Guid spaceId,
            DateTime updatedAt,
            CancellationToken cancellationToken)
        {
            var privateSpace = await this._db.PrivateSpaces
                .FirstOrDefaultAsync(x => x.SpaceId == spaceId, cancellationToken);
            var space = await this._db.Spaces
                .FirstOrDefaultAsync(x => x.Id == spaceId, cancellationToken);

            if (privateSpace != null)
            {
                privateSpace.UpdatedAt = updatedAt;
            }

            if (space != null)
            {
                space.UpdatedAt = updatedAt;
            }
        }

        internal async Task RecordMessageActivityAsync(
            Guid spaceId,
            DateTime activityAt,
            CancellationToken cancellationToken)
        {
            await this.TouchAsync(spaceId, activityAt, cancellationToken);

            var memberships = await this._db.PrivateSpaceMembers
                .Where(member =>
                    member.SpaceId == spaceId &&
                    member.StatusId ==
                    DataBase.Constants.PrivateSpaceIds.MemberStatusActive)
                .ToListAsync(cancellationToken);
            foreach (var membership in memberships)
            {
                if (membership.ListActivityAt < activityAt)
                {
                    membership.ListActivityAt = activityAt;
                }
                if (membership.HiddenFromListAt.HasValue &&
                    (!membership.HistoryClearedAt.HasValue ||
                     activityAt > membership.HistoryClearedAt.Value))
                {
                    membership.HiddenFromListAt = null;
                }
            }

            var folderItems = await this._db.PrivateSpaceFolderItems
                .Where(item => item.SpaceId == spaceId)
                .ToListAsync(cancellationToken);
            foreach (var folderItem in folderItems)
            {
                if (folderItem.ActivityAt < activityAt)
                {
                    folderItem.ActivityAt = activityAt;
                }
            }
        }
    }
}
