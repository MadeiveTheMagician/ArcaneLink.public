using System.Text.RegularExpressions;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.PrivateSpaces
{
    public sealed class PrivateSpaceFolderService : IPrivateSpaceFolderService
    {
        public static readonly Guid AllFolderId = Guid.Empty;
        private const string AllFolderName = "Все";
        private const string AllFolderIcon = "message";

        private readonly AppDbContext _db;

        public PrivateSpaceFolderService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<IReadOnlyList<PrivateSpaceFolderResponse>> GetFoldersAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var accessibleSpaceIds = await GetAccessibleSpaceIdsAsync(userId, cancellationToken);
            var accessibleSet = accessibleSpaceIds.ToHashSet();
            var isAllOrderLocked = await IsAllOrderLockedAsync(
                userId,
                cancellationToken);
            var folders = await _db.PrivateSpaceFolders
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .Include(x => x.Items)
                .OrderBy(x => x.Position)
                .ThenBy(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return new[]
                {
                    new PrivateSpaceFolderResponse
                    {
                        Id = AllFolderId,
                        Name = AllFolderName,
                        Icon = AllFolderIcon,
                        Position = -1,
                        IsSystem = true,
                        IsOrderLocked = isAllOrderLocked,
                        SpaceIds = accessibleSpaceIds,
                        PinnedSpaceIds = await GetSystemPinnedSpaceIdsAsync(
                            userId,
                            cancellationToken)
                    }
                }
                .Concat(folders.Select(folder => ToResponse(folder, accessibleSet)))
                .ToList();
        }

        public async Task<PrivateSpaceFolderMutationResult> CreateFolderAsync(
            Guid userId,
            UpsertPrivateSpaceFolderRequest request,
            CancellationToken cancellationToken = default)
        {
            var normalized = Normalize(request);
            if (normalized == null)
            {
                return new(null, "invalid_folder");
            }

            var subscriptionTypeId = await _db.Users
                .Where(x => x.Id == userId && x.DeletedAt == null)
                .Select(x => (Guid?)x.SubscriptionTypeId)
                .FirstOrDefaultAsync(cancellationToken);
            if (subscriptionTypeId == null)
            {
                return new(null, "user_not_found");
            }

            var folderCount = await _db.PrivateSpaceFolders.CountAsync(x => x.UserId == userId, cancellationToken);
            if (folderCount >= GetFolderLimit(subscriptionTypeId.Value))
            {
                return new(null, "folder_limit_reached");
            }

            var now = DateTime.UtcNow;
            var nextPosition = await _db.PrivateSpaceFolders
                .Where(x => x.UserId == userId)
                .Select(x => (int?)x.Position)
                .MaxAsync(cancellationToken) ?? -1;
            var folder = new PrivateSpaceFolder
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Name = normalized.Value.Name,
                Icon = normalized.Value.Icon,
                Color = normalized.Value.Color,
                Position = nextPosition + 1,
                IsOrderLocked = false,
                CreatedAt = now,
                UpdatedAt = now
            };

            var spaceIds = await FilterAccessibleSpaceIdsAsync(userId, request.SpaceIds, cancellationToken);
            AddItems(folder, spaceIds, now);
            _db.PrivateSpaceFolders.Add(folder);
            await _db.SaveChangesAsync(cancellationToken);

            return new(ToResponse(folder, spaceIds.ToHashSet()));
        }

        public async Task<PrivateSpaceFolderMutationResult> UpdateFolderAsync(
            Guid userId,
            Guid folderId,
            UpsertPrivateSpaceFolderRequest request,
            CancellationToken cancellationToken = default)
        {
            if (folderId == AllFolderId)
            {
                return new(null, "system_folder");
            }

            var normalized = Normalize(request);
            if (normalized == null)
            {
                return new(null, "invalid_folder");
            }

            var folder = await _db.PrivateSpaceFolders
                .Include(x => x.Items)
                .FirstOrDefaultAsync(x => x.Id == folderId && x.UserId == userId, cancellationToken);
            if (folder == null)
            {
                return new(null, "folder_not_found");
            }

            var now = DateTime.UtcNow;
            var spaceIds = await FilterAccessibleSpaceIdsAsync(userId, request.SpaceIds, cancellationToken);
            folder.Name = normalized.Value.Name;
            folder.Icon = normalized.Value.Icon;
            folder.Color = normalized.Value.Color;
            folder.UpdatedAt = now;
            var requestedSet = spaceIds.ToHashSet();
            var removedItems = folder.Items.Where(item => !requestedSet.Contains(item.SpaceId)).ToList();
            _db.PrivateSpaceFolderItems.RemoveRange(removedItems);
            foreach (var item in removedItems) folder.Items.Remove(item);
            for (var index = 0; index < spaceIds.Count; index++)
            {
                var item = folder.Items.FirstOrDefault(current => current.SpaceId == spaceIds[index]);
                if (item == null)
                {
                    folder.Items.Add(new PrivateSpaceFolderItem
                    {
                        FolderId = folder.Id,
                        SpaceId = spaceIds[index],
                        Position = index,
                        ActivityAt = now,
                        CreatedAt = now
                    });
                }
                else
                {
                    item.Position = index;
                    item.ActivityAt = now;
                }
            }
            await _db.SaveChangesAsync(cancellationToken);

            return new(ToResponse(folder, requestedSet));
        }

        public async Task<bool> DeleteFolderAsync(Guid userId, Guid folderId, CancellationToken cancellationToken = default)
        {
            if (folderId == AllFolderId) return false;
            var folder = await _db.PrivateSpaceFolders.FirstOrDefaultAsync(x => x.Id == folderId && x.UserId == userId, cancellationToken);
            if (folder == null) return false;
            _db.PrivateSpaceFolders.Remove(folder);
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> AddSpaceAsync(Guid userId, Guid folderId, Guid spaceId, CancellationToken cancellationToken = default)
        {
            if (folderId == AllFolderId || !await IsAccessibleSpaceAsync(userId, spaceId, cancellationToken)) return false;
            var folder = await _db.PrivateSpaceFolders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == folderId && x.UserId == userId, cancellationToken);
            if (folder == null) return false;
            if (folder.Items.Any(x => x.SpaceId == spaceId)) return true;

            folder.Items.Add(new PrivateSpaceFolderItem
            {
                FolderId = folder.Id,
                SpaceId = spaceId,
                Position = folder.Items.Count == 0 ? 0 : folder.Items.Max(x => x.Position) + 1,
                ActivityAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            });
            folder.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> RemoveSpaceAsync(Guid userId, Guid folderId, Guid spaceId, CancellationToken cancellationToken = default)
        {
            if (folderId == AllFolderId) return false;
            var item = await _db.PrivateSpaceFolderItems.FirstOrDefaultAsync(x => x.FolderId == folderId && x.SpaceId == spaceId && x.Folder.UserId == userId, cancellationToken);
            if (item == null) return false;
            _db.PrivateSpaceFolderItems.Remove(item);
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> ReorderFoldersAsync(Guid userId, IReadOnlyList<Guid> folderIds, CancellationToken cancellationToken = default)
        {
            var folders = await _db.PrivateSpaceFolders.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
            var requestedIds = folderIds.Where(x => x != AllFolderId).Distinct().ToList();
            if (folders.Count != requestedIds.Count || folders.Any(x => !requestedIds.Contains(x.Id))) return false;
            for (var index = 0; index < requestedIds.Count; index++) folders.First(x => x.Id == requestedIds[index]).Position = index;
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<bool> ReorderItemsAsync(Guid userId, Guid folderId, IReadOnlyList<Guid> spaceIds, CancellationToken cancellationToken = default)
        {
            var requestedIds = spaceIds.Distinct().ToList();
            var requestedIdSet = requestedIds.ToHashSet();
            if (folderId == AllFolderId)
            {
                var isOrderLocked = await IsAllOrderLockedAsync(
                    userId,
                    cancellationToken);
                var memberships = await _db.PrivateSpaceMembers
                    .Where(member =>
                        member.UserId == userId &&
                        member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                        member.HiddenFromListAt == null &&
                        member.PrivateSpace.DeletedAt == null)
                    .ToListAsync(cancellationToken);
                if (memberships.Count != requestedIds.Count ||
                    memberships.Any(member => !requestedIdSet.Contains(member.SpaceId)))
                {
                    return false;
                }
                var pinnedIds = memberships
                    .Where(member => member.PinnedAt.HasValue)
                    .OrderByDescending(member => member.PinnedAt)
                    .ThenBy(member => member.SpaceId)
                    .Select(member => member.SpaceId)
                    .ToArray();
                if (!requestedIds.Take(pinnedIds.Length).SequenceEqual(pinnedIds))
                {
                    return false;
                }

                var membershipBySpaceId = memberships.ToDictionary(
                    member => member.SpaceId);
                var reorderedAt = DateTime.UtcNow;
                for (var index = 0; index < requestedIds.Count; index++)
                {
                    var membership = membershipBySpaceId[requestedIds[index]];
                    if (!membership.PinnedAt.HasValue)
                    {
                        membership.ListPosition = index;
                        if (!isOrderLocked)
                        {
                            membership.ListActivityAt = reorderedAt;
                        }
                    }
                }

                await _db.SaveChangesAsync(cancellationToken);
                return true;
            }

            var folder = await _db.PrivateSpaceFolders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == folderId && x.UserId == userId, cancellationToken);
            if (folder == null) return false;
            if (folder.Items.Count != requestedIds.Count || folder.Items.Any(x => !requestedIdSet.Contains(x.SpaceId))) return false;
            var folderPinnedIds = folder.Items
                .Where(item => item.PinnedAt.HasValue)
                .OrderByDescending(item => item.PinnedAt)
                .ThenBy(item => item.SpaceId)
                .Select(item => item.SpaceId)
                .ToArray();
            if (!requestedIds.Take(folderPinnedIds.Length)
                    .SequenceEqual(folderPinnedIds))
            {
                return false;
            }
            var itemBySpaceId = folder.Items.ToDictionary(item => item.SpaceId);
            var folderReorderedAt = DateTime.UtcNow;
            for (var index = 0; index < requestedIds.Count; index++)
            {
                var item = itemBySpaceId[requestedIds[index]];
                if (!item.PinnedAt.HasValue)
                {
                    item.Position = index;
                    if (!folder.IsOrderLocked)
                    {
                        item.ActivityAt = folderReorderedAt;
                    }
                }
            }
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<PrivateSpaceFolderResponse?> SetPinnedAsync(
            Guid userId,
            Guid folderId,
            Guid spaceId,
            bool isPinned,
            CancellationToken cancellationToken = default)
        {
            if (!await IsAccessibleSpaceAsync(
                    userId,
                    spaceId,
                    cancellationToken))
            {
                return null;
            }

            var pinnedAt = isPinned ? DateTime.UtcNow : (DateTime?)null;
            if (folderId == AllFolderId)
            {
                var membership = await _db.PrivateSpaceMembers
                    .FirstOrDefaultAsync(
                        member =>
                            member.UserId == userId &&
                            member.SpaceId == spaceId &&
                            member.StatusId ==
                            PrivateSpaceIds.MemberStatusActive,
                        cancellationToken);
                if (membership == null)
                {
                    return null;
                }

                membership.PinnedAt = pinnedAt;
                membership.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                var item = await _db.PrivateSpaceFolderItems
                    .FirstOrDefaultAsync(
                        folderItem =>
                            folderItem.FolderId == folderId &&
                            folderItem.SpaceId == spaceId &&
                            folderItem.Folder.UserId == userId,
                        cancellationToken);
                if (item == null)
                {
                    return null;
                }

                item.PinnedAt = pinnedAt;
            }

            await _db.SaveChangesAsync(cancellationToken);
            return (await GetFoldersAsync(userId, cancellationToken))
                .First(folder => folder.Id == folderId);
        }

        public async Task<PrivateSpaceFolderResponse?> SetOrderLockedAsync(
            Guid userId,
            Guid folderId,
            bool isLocked,
            CancellationToken cancellationToken = default)
        {
            if (folderId == AllFolderId)
            {
                var settings = await _db.UserProfileSettings
                    .FirstOrDefaultAsync(
                        item => item.UserId == userId,
                        cancellationToken);
                if (settings == null)
                {
                    return null;
                }

                if (isLocked &&
                    !settings.IsAllPrivateSpaceOrderLocked)
                {
                    var memberships = await _db.PrivateSpaceMembers
                        .Where(member =>
                            member.UserId == userId &&
                            member.StatusId ==
                            PrivateSpaceIds.MemberStatusActive &&
                            member.HiddenFromListAt == null &&
                            member.PrivateSpace.DeletedAt == null &&
                            !member.PinnedAt.HasValue)
                        .OrderByDescending(member => member.ListActivityAt)
                        .ThenBy(member => member.ListPosition)
                        .ThenBy(member => member.SpaceId)
                        .ToListAsync(cancellationToken);
                    for (var index = 0; index < memberships.Count; index++)
                    {
                        memberships[index].ListPosition = index;
                    }
                }

                settings.IsAllPrivateSpaceOrderLocked = isLocked;
                settings.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                var folder = await _db.PrivateSpaceFolders
                    .Include(item => item.Items)
                    .FirstOrDefaultAsync(
                        item =>
                            item.Id == folderId &&
                            item.UserId == userId,
                        cancellationToken);
                if (folder == null)
                {
                    return null;
                }

                if (isLocked && !folder.IsOrderLocked)
                {
                    var items = folder.Items
                        .Where(item => !item.PinnedAt.HasValue)
                        .OrderByDescending(item => item.ActivityAt)
                        .ThenBy(item => item.Position)
                        .ThenBy(item => item.SpaceId)
                        .ToList();
                    for (var index = 0; index < items.Count; index++)
                    {
                        items[index].Position = index;
                    }
                }

                folder.IsOrderLocked = isLocked;
                folder.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(cancellationToken);
            return (await GetFoldersAsync(userId, cancellationToken))
                .First(folder => folder.Id == folderId);
        }

        private static int GetFolderLimit(Guid subscriptionTypeId) =>
            subscriptionTypeId == SubscriptionTypeIds.Prime ? 24 :
            subscriptionTypeId == SubscriptionTypeIds.Plus ? 12 : 6;

        private async Task<List<Guid>> GetAccessibleSpaceIdsAsync(
            Guid userId,
            CancellationToken cancellationToken)
        {
            var isOrderLocked = await IsAllOrderLockedAsync(
                userId,
                cancellationToken);
            var memberships = _db.PrivateSpaceMembers
                .Where(x =>
                    x.UserId == userId &&
                    x.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    x.HiddenFromListAt == null &&
                    x.PrivateSpace.DeletedAt == null);
            IOrderedQueryable<PrivateSpaceMember> orderedMemberships =
                memberships
                    .OrderByDescending(x => x.PinnedAt.HasValue)
                    .ThenByDescending(x => x.PinnedAt);
            orderedMemberships = isOrderLocked
                ? orderedMemberships.ThenBy(x => x.ListPosition)
                : orderedMemberships
                    .ThenByDescending(x => x.ListActivityAt)
                    .ThenBy(x => x.ListPosition);

            return await orderedMemberships
                .ThenBy(x => x.SpaceId)
                .Select(x => x.SpaceId)
                .ToListAsync(cancellationToken);
        }

        private async Task<IReadOnlyList<Guid>> GetSystemPinnedSpaceIdsAsync(
            Guid userId,
            CancellationToken cancellationToken) =>
            await _db.PrivateSpaceMembers
                .AsNoTracking()
                .Where(member =>
                    member.UserId == userId &&
                    member.StatusId == PrivateSpaceIds.MemberStatusActive &&
                    member.HiddenFromListAt == null &&
                    member.PinnedAt.HasValue &&
                    member.PrivateSpace.DeletedAt == null)
                .OrderByDescending(member => member.PinnedAt)
                .ThenBy(member => member.SpaceId)
                .Select(member => member.SpaceId)
                .ToListAsync(cancellationToken);

        private async Task<List<Guid>> FilterAccessibleSpaceIdsAsync(Guid userId, IEnumerable<Guid> requestedSpaceIds, CancellationToken cancellationToken)
        {
            var requested = requestedSpaceIds.Distinct().ToList();
            return await _db.PrivateSpaceMembers
                .Where(x => requested.Contains(x.SpaceId) && x.UserId == userId && x.StatusId == PrivateSpaceIds.MemberStatusActive && x.HiddenFromListAt == null && x.PrivateSpace.DeletedAt == null)
                .Select(x => x.SpaceId)
                .ToListAsync(cancellationToken);
        }

        private Task<bool> IsAccessibleSpaceAsync(Guid userId, Guid spaceId, CancellationToken cancellationToken) =>
            _db.PrivateSpaceMembers.AnyAsync(x => x.SpaceId == spaceId && x.UserId == userId && x.StatusId == PrivateSpaceIds.MemberStatusActive && x.HiddenFromListAt == null && x.PrivateSpace.DeletedAt == null, cancellationToken);

        private static void AddItems(PrivateSpaceFolder folder, IReadOnlyList<Guid> spaceIds, DateTime now)
        {
            for (var index = 0; index < spaceIds.Count; index++)
            {
                folder.Items.Add(new PrivateSpaceFolderItem { FolderId = folder.Id, SpaceId = spaceIds[index], Position = index, ActivityAt = now, CreatedAt = now });
            }
        }

        private static PrivateSpaceFolderResponse ToResponse(PrivateSpaceFolder folder, HashSet<Guid> accessibleSpaceIds) => new()
        {
            Id = folder.Id,
            Name = folder.Name,
            Icon = folder.Icon,
            Color = folder.Color,
            Position = folder.Position,
            IsSystem = false,
            IsOrderLocked = folder.IsOrderLocked,
            SpaceIds = OrderFolderItems(folder)
                .Where(x => accessibleSpaceIds.Contains(x.SpaceId))
                .Select(x => x.SpaceId)
                .ToList(),
            PinnedSpaceIds = folder.Items
                .Where(x =>
                    accessibleSpaceIds.Contains(x.SpaceId) &&
                    x.PinnedAt.HasValue)
                .OrderByDescending(x => x.PinnedAt)
                .ThenBy(x => x.SpaceId)
                .Select(x => x.SpaceId)
                .ToList()
        };

        private static IOrderedEnumerable<PrivateSpaceFolderItem>
            OrderFolderItems(PrivateSpaceFolder folder)
        {
            var items = folder.Items
                .OrderByDescending(item => item.PinnedAt.HasValue)
                .ThenByDescending(item => item.PinnedAt);
            return folder.IsOrderLocked
                ? items
                    .ThenBy(item => item.Position)
                    .ThenBy(item => item.SpaceId)
                : items
                    .ThenByDescending(item => item.ActivityAt)
                    .ThenBy(item => item.Position)
                    .ThenBy(item => item.SpaceId);
        }

        private async Task<bool> IsAllOrderLockedAsync(
            Guid userId,
            CancellationToken cancellationToken)
        {
            return await _db.UserProfileSettings
                .AsNoTracking()
                .Where(settings => settings.UserId == userId)
                .Select(settings =>
                    (bool?)settings.IsAllPrivateSpaceOrderLocked)
                .SingleOrDefaultAsync(cancellationToken) ?? false;
        }

        private static (string Name, string Icon, string? Color)? Normalize(UpsertPrivateSpaceFolderRequest request)
        {
            var name = request.Name.Trim();
            var icon = request.Icon.Trim();
            var color = string.IsNullOrWhiteSpace(request.Color) ? null : request.Color.Trim();
            if (name.Length is < 1 or > UpsertPrivateSpaceFolderRequest.NameMaxLength || icon.Length is < 1 or > 16 || (color != null && !Regex.IsMatch(color, "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"))) return null;
            return (name, icon, color);
        }
    }
}
