using System.Globalization;
using System.Text;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Users
{
    public sealed class DirectMessagePrivacyService : IDirectMessagePrivacyService
    {
        private readonly AppDbContext _db;

        public DirectMessagePrivacyService(AppDbContext db)
        {
            this._db = db;
        }

        public Task<bool> CanStartConversationAsync(
            Guid initiatorUserId,
            Guid targetUserId,
            CancellationToken cancellationToken = default)
        {
            return this.CanStartConversationsAsync(
                initiatorUserId,
                [targetUserId],
                cancellationToken);
        }

        public async Task<bool> CanStartConversationsAsync(
            Guid initiatorUserId,
            IReadOnlyCollection<Guid> targetUserIds,
            CancellationToken cancellationToken = default)
        {
            var targets = targetUserIds
                .Where(userId => userId != initiatorUserId)
                .Distinct()
                .ToArray();
            if (targets.Length == 0)
            {
                return true;
            }
            var participants = targets
                .Append(initiatorUserId)
                .Distinct()
                .ToArray();
            var interactions = targets
                .SelectMany(targetId => participants
                    .Where(senderId => senderId != targetId)
                    .Select(senderId => (SenderId: senderId, TargetId: targetId)))
                .ToArray();

            return await this.AreInteractionsAllowedAsync(
                participants,
                interactions,
                cancellationToken);
        }

        public async Task<bool> CanAddParticipantAsync(
            Guid initiatorUserId,
            Guid newUserId,
            IReadOnlyCollection<Guid> existingUserIds,
            CancellationToken cancellationToken = default)
        {
            if (newUserId == initiatorUserId)
            {
                return false;
            }

            var existing = existingUserIds
                .Where(userId => userId != newUserId)
                .Append(initiatorUserId)
                .Distinct()
                .ToArray();
            var participants = existing.Append(newUserId).ToArray();
            var interactions = existing
                .Select(userId => (SenderId: userId, TargetId: newUserId))
                .Concat(existing
                    .Where(userId => userId != initiatorUserId)
                    .Select(userId => (SenderId: newUserId, TargetId: userId)))
                .ToArray();

            return await this.AreInteractionsAllowedAsync(
                participants,
                interactions,
                cancellationToken);
        }

        public async Task<bool> CanSendDirectMessageAsync(
            Guid senderUserId,
            Guid spaceId,
            CancellationToken cancellationToken = default)
        {
            var context = await this._db.PrivateSpaces
                .AsNoTracking()
                .Where(space =>
                    space.SpaceId == spaceId &&
                    space.DeletedAt == null &&
                    space.Space.DeletedAt == null)
                .Select(space => new
                {
                    space.Kind,
                    space.DirectUserLowId,
                    space.DirectUserHighId,
                    IsActiveSender = space.Members.Any(member =>
                        member.UserId == senderUserId &&
                        member.StatusId ==
                        PrivateSpaceIds.MemberStatusActive)
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (context == null || !context.IsActiveSender)
            {
                return false;
            }
            if (context.Kind != PrivateSpaceKindCodes.Direct)
            {
                return true;
            }

            if (!context.DirectUserLowId.HasValue ||
                !context.DirectUserHighId.HasValue)
            {
                return false;
            }
            var participantIds = new[]
            {
                context.DirectUserLowId.Value,
                context.DirectUserHighId.Value
            };
            var targetUserId = participantIds.FirstOrDefault(
                userId => userId != senderUserId);
            if (targetUserId == Guid.Empty)
            {
                return false;
            }

            return await this.AreInteractionsAllowedAsync(
                participantIds,
                [(SenderId: senderUserId, TargetId: targetUserId)],
                cancellationToken);
        }

        private async Task<bool> AreInteractionsAllowedAsync(
            IReadOnlyCollection<Guid> participantUserIds,
            IReadOnlyCollection<(Guid SenderId, Guid TargetId)> interactions,
            CancellationToken cancellationToken)
        {
            if (interactions.Count == 0)
            {
                return true;
            }

            var participants = participantUserIds.Distinct().ToArray();
            var targetIds = interactions
                .Select(interaction => interaction.TargetId)
                .Distinct()
                .ToArray();
            var activeUserIds = await this._db.Users
                .AsNoTracking()
                .Where(user =>
                    participants.Contains(user.Id) &&
                    user.StatusId == UserStatusIds.Active &&
                    user.DeletedAt == null)
                .Select(user => user.Id)
                .ToListAsync(cancellationToken);
            if (activeUserIds.Count != participants.Length)
            {
                return false;
            }

            var policies = await this._db.Users
                .AsNoTracking()
                .Where(user => targetIds.Contains(user.Id))
                .Select(user => new
                {
                    user.Id,
                    Permission = user.ProfileSettings == null
                        ? DirectMessagePrivacyCodes.Everyone
                        : user.ProfileSettings.DirectMessagePermission
                })
                .ToListAsync(cancellationToken);
            if (policies.Count != targetIds.Length)
            {
                return false;
            }

            var blockedRelations = await this._db.UserDirectMessageBlocks
                .AsNoTracking()
                .Where(block =>
                    participants.Contains(block.UserId) &&
                    participants.Contains(block.BlockedUserId))
                .Select(block => new
                {
                    block.UserId,
                    block.BlockedUserId
                })
                .ToListAsync(cancellationToken);
            var interactionSet = interactions.ToHashSet();
            if (blockedRelations.Any(block =>
                    interactionSet.Contains((block.UserId, block.BlockedUserId)) ||
                    interactionSet.Contains((block.BlockedUserId, block.UserId))))
            {
                return false;
            }

            var friendRelations = (await this._db.UserFriends
                    .AsNoTracking()
                    .Where(friend =>
                        targetIds.Contains(friend.UserId) &&
                        participants.Contains(friend.FriendUserId) &&
                        friend.CreatedByRequest.StatusId ==
                        FriendRequestStatusIds.Accepted)
                    .Select(friend => new
                    {
                        friend.UserId,
                        friend.FriendUserId
                    })
                    .ToListAsync(cancellationToken))
                .Select(friend => (friend.UserId, friend.FriendUserId))
                .ToHashSet();
            var friendsOfFriendsRelations = (await (
                    from targetFriend in this._db.UserFriends.AsNoTracking()
                    join senderFriend in this._db.UserFriends.AsNoTracking()
                        on targetFriend.FriendUserId equals
                        senderFriend.FriendUserId
                    where
                        targetIds.Contains(targetFriend.UserId) &&
                        participants.Contains(senderFriend.UserId) &&
                        targetFriend.UserId != senderFriend.UserId &&
                        targetFriend.CreatedByRequest.StatusId ==
                        FriendRequestStatusIds.Accepted &&
                        senderFriend.CreatedByRequest.StatusId ==
                        FriendRequestStatusIds.Accepted &&
                        targetFriend.FriendUser.StatusId ==
                        UserStatusIds.Active &&
                        targetFriend.FriendUser.DeletedAt == null
                    select new
                    {
                        TargetId = targetFriend.UserId,
                        SenderId = senderFriend.UserId
                    })
                .Distinct()
                .ToListAsync(cancellationToken))
                .Select(relation =>
                    (relation.TargetId, relation.SenderId))
                .ToHashSet();
            var sharedServerMemberships = await this._db.ServerMembers
                    .AsNoTracking()
                    .Where(member =>
                        participants.Contains(member.UserId) &&
                        member.StatusId == ServerMemberStatusIds.Active &&
                        member.BannedAt == null &&
                        member.Server.DeletedAt == null)
                    .Select(member => new
                    {
                        member.ServerId,
                        member.UserId
                    })
                    .Distinct()
                    .ToListAsync(cancellationToken);
            var sharedServerRelations = new HashSet<(Guid TargetId, Guid SenderId)>();
            foreach (var serverMembers in sharedServerMemberships
                         .GroupBy(member => member.ServerId)
                         .Select(group => group
                             .Select(member => member.UserId)
                             .Distinct()
                             .ToArray()))
            {
                foreach (var targetId in serverMembers.Where(
                             userId => targetIds.Contains(userId)))
                {
                    foreach (var senderId in serverMembers.Where(
                                 userId => userId != targetId))
                    {
                        sharedServerRelations.Add((targetId, senderId));
                    }
                }
            }

            return policies.All(policy =>
            {
                var permission =
                    DirectMessagePrivacyCodes.ParseOrNobody(
                        policy.Permission);
                return interactions
                    .Where(interaction => interaction.TargetId == policy.Id)
                    .Select(interaction => interaction.SenderId)
                    .All(senderId =>
                        permission.AllowsEveryone ||
                        permission.AllowsFriends &&
                        friendRelations.Contains((policy.Id, senderId)) ||
                        permission.AllowsFriendsOfFriends &&
                        friendsOfFriendsRelations.Contains(
                            (policy.Id, senderId)) ||
                        permission.AllowsSharedServers &&
                        sharedServerRelations.Contains((policy.Id, senderId)));
            });
        }

        public async Task<DirectMessageBlockedUsersPageResponse?>
            GetBlockedUsersAsync(
                Guid userId,
                int limit = 100,
                string? cursor = null,
                CancellationToken cancellationToken = default)
        {
            var pageSize = Math.Clamp(limit, 1, 100);
            BlockCursor? decodedCursor = null;
            if (cursor != null &&
                !TryDecodeCursor(cursor, out decodedCursor))
            {
                return null;
            }

            var query = this._db.UserDirectMessageBlocks
                .AsNoTracking()
                .Where(block =>
                    block.UserId == userId &&
                    block.BlockedUser.StatusId == UserStatusIds.Active &&
                    block.BlockedUser.DeletedAt == null);
            var totalCount = await query.LongCountAsync(cancellationToken);
            if (decodedCursor != null)
            {
                query = query.Where(block =>
                    block.CreatedAt < decodedCursor.CreatedAt ||
                    block.CreatedAt == decodedCursor.CreatedAt &&
                    block.BlockedUserId.CompareTo(
                        decodedCursor.BlockedUserId) < 0);
            }

            var rows = await query
                .OrderByDescending(block => block.CreatedAt)
                .ThenByDescending(block => block.BlockedUserId)
                .Select(block => new DirectMessageBlockedUserResponse
                {
                    UserId = block.BlockedUserId,
                    IsBlocked = true,
                    Login = block.BlockedUser.Login,
                    DisplayName = block.BlockedUser.Profile.DisplayName,
                    AvatarAssetId = block.BlockedUser.Profile.AvatarAssetId,
                    AvatarCropOffsetX =
                        block.BlockedUser.Profile.AvatarCropOffsetX,
                    AvatarCropOffsetY =
                        block.BlockedUser.Profile.AvatarCropOffsetY,
                    AvatarCropZoom = block.BlockedUser.Profile.AvatarCropZoom,
                    Comment = block.Comment,
                    CreatedAt = block.CreatedAt
                })
                .Take(pageSize + 1)
                .ToListAsync(cancellationToken);

            var hasNextPage = rows.Count > pageSize;
            if (hasNextPage)
            {
                rows.RemoveAt(rows.Count - 1);
            }

            var last = rows.LastOrDefault();
            return new DirectMessageBlockedUsersPageResponse
            {
                Items = rows,
                NextCursor = hasNextPage && last != null
                    ? EncodeCursor(last.CreatedAt, last.UserId)
                    : null,
                TotalCount = totalCount
            };
        }

        public async Task<DirectMessageBlockStatusResponse> GetBlockStatusAsync(
            Guid userId,
            Guid blockedUserId,
            CancellationToken cancellationToken = default)
        {
            var block = await this._db.UserDirectMessageBlocks
                .AsNoTracking()
                .Where(item =>
                    item.UserId == userId &&
                    item.BlockedUserId == blockedUserId)
                .Select(item => new
                {
                    item.Comment,
                    item.CreatedAt
                })
                .SingleOrDefaultAsync(cancellationToken);

            return new DirectMessageBlockStatusResponse
            {
                UserId = blockedUserId,
                IsBlocked = block != null,
                Comment = block?.Comment,
                CreatedAt = block?.CreatedAt
            };
        }

        public async Task<DirectMessageBlockedUserResponse?> BlockAsync(
            Guid userId,
            Guid blockedUserId,
            string? comment = null,
            bool updateComment = false,
            CancellationToken cancellationToken = default)
        {
            var normalizedComment = NormalizeComment(comment);
            if (normalizedComment?.Length >
                UpdateDirectMessageBlockRequest.CommentMaxLength)
            {
                return null;
            }
            if (userId == blockedUserId ||
                !await this._db.Users.AsNoTracking().AnyAsync(
                    user =>
                        user.Id == blockedUserId &&
                        user.StatusId == UserStatusIds.Active &&
                        user.DeletedAt == null,
                    cancellationToken))
            {
                return null;
            }

            var block = await this._db.UserDirectMessageBlocks
                .Include(item => item.BlockedUser)
                    .ThenInclude(user => user.Profile)
                .FirstOrDefaultAsync(
                    item =>
                        item.UserId == userId &&
                        item.BlockedUserId == blockedUserId,
                    cancellationToken);
            if (block == null)
            {
                block = new UserDirectMessageBlock
                {
                    UserId = userId,
                    BlockedUserId = blockedUserId,
                    Comment = normalizedComment,
                    CreatedAt = DateTime.UtcNow
                };
                this._db.UserDirectMessageBlocks.Add(block);
                try
                {
                    await this._db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException)
                {
                    this._db.ChangeTracker.Clear();
                    block = await this._db.UserDirectMessageBlocks
                        .Include(item => item.BlockedUser)
                            .ThenInclude(user => user.Profile)
                        .FirstOrDefaultAsync(
                            item =>
                                item.UserId == userId &&
                                item.BlockedUserId == blockedUserId,
                            cancellationToken);
                    if (block == null)
                    {
                        throw;
                    }
                    if (updateComment)
                    {
                        block.Comment = normalizedComment;
                        await this._db.SaveChangesAsync(cancellationToken);
                    }
                }
                await this._db.Entry(block)
                    .Reference(item => item.BlockedUser)
                    .Query()
                    .Include(user => user.Profile)
                    .LoadAsync(cancellationToken);
            }
            else if (updateComment && block.Comment != normalizedComment)
            {
                block.Comment = normalizedComment;
                await this._db.SaveChangesAsync(cancellationToken);
            }

            return ToResponse(block);
        }

        public async Task<bool> UnblockAsync(
            Guid userId,
            Guid blockedUserId,
            CancellationToken cancellationToken = default)
        {
            var deleted = await this._db.UserDirectMessageBlocks
                .Where(block =>
                    block.UserId == userId &&
                    block.BlockedUserId == blockedUserId)
                .ExecuteDeleteAsync(cancellationToken);

            return deleted > 0;
        }

        private static DirectMessageBlockedUserResponse ToResponse(
            UserDirectMessageBlock block)
        {
            return new DirectMessageBlockedUserResponse
            {
                UserId = block.BlockedUserId,
                IsBlocked = true,
                Login = block.BlockedUser.Login,
                DisplayName = block.BlockedUser.Profile.DisplayName,
                AvatarAssetId = block.BlockedUser.Profile.AvatarAssetId,
                AvatarCropOffsetX = block.BlockedUser.Profile.AvatarCropOffsetX,
                AvatarCropOffsetY = block.BlockedUser.Profile.AvatarCropOffsetY,
                AvatarCropZoom = block.BlockedUser.Profile.AvatarCropZoom,
                Comment = block.Comment,
                CreatedAt = block.CreatedAt
            };
        }

        private static string? NormalizeComment(string? comment)
        {
            var normalized = comment?.Trim();
            return string.IsNullOrEmpty(normalized) ? null : normalized;
        }

        private static string EncodeCursor(
            DateTime createdAt,
            Guid blockedUserId)
        {
            var value = string.Create(
                CultureInfo.InvariantCulture,
                $"{createdAt.Ticks}:{blockedUserId:N}");
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        private static bool TryDecodeCursor(
            string cursor,
            out BlockCursor? value)
        {
            value = null;
            try
            {
                var base64 = cursor.Replace('-', '+').Replace('_', '/');
                base64 = base64.PadRight(
                    base64.Length + (4 - base64.Length % 4) % 4,
                    '=');
                var raw = Encoding.UTF8.GetString(
                    Convert.FromBase64String(base64));
                var separatorIndex = raw.IndexOf(':');
                if (separatorIndex <= 0 ||
                    !long.TryParse(
                        raw[..separatorIndex],
                        NumberStyles.None,
                        CultureInfo.InvariantCulture,
                        out var ticks) ||
                    !Guid.TryParseExact(raw[(separatorIndex + 1)..], "N", out var id) ||
                    ticks < DateTime.MinValue.Ticks ||
                    ticks > DateTime.MaxValue.Ticks)
                {
                    return false;
                }

                value = new BlockCursor(
                    new DateTime(ticks, DateTimeKind.Utc),
                    id);
                return true;
            }
            catch (FormatException)
            {
                return false;
            }
        }

        private sealed record BlockCursor(
            DateTime CreatedAt,
            Guid BlockedUserId);
    }
}
