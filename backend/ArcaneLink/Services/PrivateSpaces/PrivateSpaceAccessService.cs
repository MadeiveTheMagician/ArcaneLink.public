using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces;

public sealed class PrivateSpaceAccessService
{
    private readonly AppDbContext _db;

    public PrivateSpaceAccessService(AppDbContext db)
    {
        this._db = db;
    }

    internal async Task<bool> IsActiveMemberAsync(
        Guid userId,
        Guid spaceId,
        CancellationToken cancellationToken)
    {
        return await this._db.PrivateSpaceMembers.AnyAsync(
            x => x.SpaceId == spaceId &&
                 x.UserId == userId &&
                 x.StatusId == PrivateSpaceIds.MemberStatusActive &&
                 x.PrivateSpace.DeletedAt == null,
            cancellationToken);
    }

    internal async Task<bool> AreActiveUsersAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken)
    {
        var count = await this._db.Users.CountAsync(
            x => userIds.Contains(x.Id) &&
                 x.DeletedAt == null &&
                 x.StatusId == UserStatusIds.Active,
            cancellationToken);

        return count == userIds.Count;
    }

    internal async Task<bool> IsActiveUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await this._db.Users.AnyAsync(
            x => x.Id == userId &&
                 x.DeletedAt == null &&
                 x.StatusId == UserStatusIds.Active,
            cancellationToken);
    }
}
