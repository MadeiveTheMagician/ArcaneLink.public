using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;
using static ArcaneLink.Services.Users.UserProfileResponseMapper;

namespace ArcaneLink.Services.Users;

public class UserProfileTagService : IUserProfileTagService
{
    private readonly AppDbContext _db;
    private readonly IRealtimeNotificationService _realtime;

    public UserProfileTagService(
        AppDbContext db,
        IRealtimeNotificationService realtime)
    {
        this._db = db;
        this._realtime = realtime;
    }

    public async Task<IReadOnlyList<ProfileTagResponse>> GetProfileTagsAsync(
        CancellationToken cancellationToken = default)
    {
        var tags = await this._db.ProfileTags
            .AsNoTracking()
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.Title)
            .ToListAsync(cancellationToken);

        return tags.Select(ToProfileTagResponse).ToList();
    }

    public async Task<IReadOnlyList<ProfileTagResponse>> GetUserProfileTagsAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var tags = await this._db.UserProfileTags
            .AsNoTracking()
            .Include(x => x.Tag)
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Tag.DisplayOrder)
            .Select(x => x.Tag)
            .ToListAsync(cancellationToken);

        return tags.Select(ToProfileTagResponse).ToList();
    }

    public async Task<IReadOnlyList<ProfileTagResponse>?> UpdateUserProfileTagsAsync(
        Guid userId,
        UpdateUserProfileTagsRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await this._db.Users
            .Include(x => x.Profile)
            .FirstOrDefaultAsync(
                x => x.Id == userId &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active,
                cancellationToken);

        if (user == null)
        {
            return null;
        }

        await this.ReplaceUserProfileTagsAsync(userId, request.TagIds, cancellationToken);

        user.UpdatedAt = DateTime.UtcNow;
        user.Profile.UpdatedAt = DateTime.UtcNow;
        await this._db.SaveChangesAsync(cancellationToken);
        await this._realtime.NotifyUserAsync(
            userId,
            RealtimeEventNames.UserProfileChanged,
            new { userId },
            cancellationToken);

        return await this.GetUserProfileTagsAsync(userId, cancellationToken);
    }

    public async Task ReplaceUserProfileTagsAsync(
        Guid userId,
        IEnumerable<Guid> tagIds,
        CancellationToken cancellationToken = default)
    {
        var distinctTagIds = tagIds
            .Where(x => x != Guid.Empty)
            .Distinct()
            .Take(12)
            .ToList();

        var validTagIds = distinctTagIds.Count == 0
            ? []
            : await this._db.ProfileTags
                .Where(x => distinctTagIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
        var validTagIdSet = validTagIds.ToHashSet();
        var existingTags = await this._db.UserProfileTags
            .Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken);

        this._db.UserProfileTags.RemoveRange(
            existingTags.Where(x => !validTagIdSet.Contains(x.TagId)));

        var existingTagIds = existingTags
            .Where(x => validTagIdSet.Contains(x.TagId))
            .Select(x => x.TagId)
            .ToHashSet();
        var now = DateTime.UtcNow;

        foreach (var tagId in validTagIds.Where(x => !existingTagIds.Contains(x)))
        {
            this._db.UserProfileTags.Add(new UserProfileTag
            {
                UserId = userId,
                TagId = tagId,
                CreatedAt = now
            });
        }
    }
}
