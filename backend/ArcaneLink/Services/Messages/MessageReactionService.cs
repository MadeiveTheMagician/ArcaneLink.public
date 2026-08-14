using System.Globalization;
using System.Text;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.PrivateSpaces;
using ArcaneLink.Services.Spaces;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Messages
{
    public sealed class MessageReactionService
    {
        private const int MaxEmojiCodeLength = 64;

        private readonly AppDbContext _db;
        private readonly SpaceMessageAccessService _serverAccess;
        private readonly PrivateSpaceAccessService _privateAccess;
        private readonly SpaceMessageNotifier _serverNotifier;
        private readonly PrivateSpaceRealtimeNotifier _privateNotifier;
        private readonly TimeProvider _timeProvider;

        public MessageReactionService(
            AppDbContext db,
            SpaceMessageAccessService serverAccess,
            PrivateSpaceAccessService privateAccess,
            SpaceMessageNotifier serverNotifier,
            PrivateSpaceRealtimeNotifier privateNotifier,
            TimeProvider timeProvider)
        {
            _db = db;
            _serverAccess = serverAccess;
            _privateAccess = privateAccess;
            _serverNotifier = serverNotifier;
            _privateNotifier = privateNotifier;
            _timeProvider = timeProvider;
        }

        public async Task<MessageReactionMutationResult> SetServerReactionAsync(
            Guid currentUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            string? emojiCode,
            bool isPresent,
            CancellationToken cancellationToken = default)
        {
            var normalizedEmoji = NormalizeEmoji(emojiCode);
            if (normalizedEmoji == null)
            {
                return MessageReactionMutationResult.InvalidEmoji();
            }

            if (await _serverAccess.GetReactableMessageSpaceAsync(
                    currentUserId,
                    serverId,
                    spaceId,
                    cancellationToken) == null ||
                !await _db.SpaceMessages.AsNoTracking().AnyAsync(
                    message =>
                        message.Id == messageId &&
                        message.SpaceId == spaceId &&
                        message.Space.ServerId == serverId &&
                        message.DeletedAt == null,
                    cancellationToken))
            {
                return MessageReactionMutationResult.NotFound();
            }

            var changed = await SetReactionStateAsync(
                currentUserId,
                messageId,
                normalizedEmoji,
                isPresent,
                cancellationToken);

            if (changed)
            {
                await _serverNotifier.NotifyMessagesChangedAsync(
                    serverId,
                    spaceId,
                    messageId,
                    cancellationToken);
            }

            var message = await SpaceMessageQueryService.LoadMutationResponseAsync(
                _db,
                currentUserId,
                serverId,
                spaceId,
                messageId,
                cancellationToken);

            return message == null
                ? MessageReactionMutationResult.NotFound()
                : MessageReactionMutationResult.Success(message);
        }

        public async Task<MessageReactionMutationResult> SetPrivateReactionAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            string? emojiCode,
            bool isPresent,
            CancellationToken cancellationToken = default)
        {
            var normalizedEmoji = NormalizeEmoji(emojiCode);
            if (normalizedEmoji == null)
            {
                return MessageReactionMutationResult.InvalidEmoji();
            }

            if (!await _privateAccess.IsActiveMemberAsync(
                    currentUserId,
                    spaceId,
                    cancellationToken) ||
                !await _db.SpaceMessages.AsNoTracking().AnyAsync(
                    message =>
                        message.Id == messageId &&
                        message.SpaceId == spaceId &&
                        message.Space.PrivateSpace != null &&
                        message.Space.PrivateSpace.DeletedAt == null &&
                        message.DeletedAt == null &&
                        !message.UserDeletions.Any(deletion => deletion.UserId == currentUserId),
                    cancellationToken))
            {
                return MessageReactionMutationResult.NotFound();
            }

            var changed = await SetReactionStateAsync(
                currentUserId,
                messageId,
                normalizedEmoji,
                isPresent,
                cancellationToken);

            if (changed)
            {
                await _privateNotifier.NotifyMessagesChangedAsync(
                    spaceId,
                    messageId,
                    cancellationToken);
            }

            var message = await LoadPrivateMessageAsync(
                currentUserId,
                spaceId,
                messageId,
                cancellationToken);

            return message == null
                ? MessageReactionMutationResult.NotFound()
                : MessageReactionMutationResult.Success(message);
        }

        private async Task<bool> SetReactionStateAsync(
            Guid currentUserId,
            Guid messageId,
            string emojiCode,
            bool isPresent,
            CancellationToken cancellationToken)
        {
            var existing = await _db.SpaceMessageReactions.FirstOrDefaultAsync(
                reaction =>
                    reaction.MessageId == messageId &&
                    reaction.UserId == currentUserId &&
                    reaction.EmojiCode == emojiCode,
                cancellationToken);

            if (isPresent)
            {
                if (existing != null)
                {
                    return false;
                }

                var reaction = new SpaceMessageReaction
                {
                    MessageId = messageId,
                    UserId = currentUserId,
                    EmojiCode = emojiCode,
                    CreatedAt = _timeProvider.GetUtcNow().UtcDateTime
                };
                _db.SpaceMessageReactions.Add(reaction);

                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                    return true;
                }
                catch (DbUpdateException)
                {
                    _db.Entry(reaction).State = EntityState.Detached;
                    if (!await ReactionExistsAsync(
                            currentUserId,
                            messageId,
                            emojiCode,
                            cancellationToken))
                    {
                        throw;
                    }

                    return false;
                }
            }

            if (existing == null)
            {
                return false;
            }

            _db.SpaceMessageReactions.Remove(existing);
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
                return true;
            }
            catch (DbUpdateConcurrencyException)
            {
                _db.Entry(existing).State = EntityState.Detached;
                return false;
            }
        }

        private Task<bool> ReactionExistsAsync(
            Guid currentUserId,
            Guid messageId,
            string emojiCode,
            CancellationToken cancellationToken)
        {
            return _db.SpaceMessageReactions.AsNoTracking().AnyAsync(
                reaction =>
                    reaction.MessageId == messageId &&
                    reaction.UserId == currentUserId &&
                    reaction.EmojiCode == emojiCode,
                cancellationToken);
        }

        private async Task<SpaceMessageResponse?> LoadPrivateMessageAsync(
            Guid currentUserId,
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken)
        {
            if (!await _privateAccess.IsActiveMemberAsync(
                    currentUserId,
                    spaceId,
                    cancellationToken))
            {
                return null;
            }

            var message = await PrivateSpaceQueries.LoadMessages(_db)
                .FirstOrDefaultAsync(
                    candidate =>
                        candidate.Id == messageId &&
                        candidate.SpaceId == spaceId &&
                        candidate.DeletedAt == null &&
                        !candidate.UserDeletions.Any(deletion => deletion.UserId == currentUserId),
                    cancellationToken);

            return message == null
                ? null
                : SpaceMessageMapper.ToResponse(message, currentUserId);
        }

        internal static string? NormalizeEmoji(string? emojiCode)
        {
            if (string.IsNullOrWhiteSpace(emojiCode) ||
                emojiCode.Length > MaxEmojiCodeLength)
            {
                return null;
            }

            var trimmed = emojiCode.Trim();
            if (trimmed.Length == 0 || trimmed.Length > MaxEmojiCodeLength)
            {
                return null;
            }

            string normalized;
            try
            {
                normalized = trimmed.Normalize(NormalizationForm.FormC);
            }
            catch (ArgumentException)
            {
                return null;
            }

            if (normalized.Length == 0 || normalized.Length > MaxEmojiCodeLength)
            {
                return null;
            }

            var textElements = StringInfo.ParseCombiningCharacters(normalized);
            if (textElements.Length != 1)
            {
                return null;
            }

            var runes = normalized.EnumerateRunes().ToArray();
            if (IsKeycapEmoji(runes))
            {
                return normalized;
            }

            var containsEmojiBase = false;
            foreach (var rune in runes)
            {
                var category = Rune.GetUnicodeCategory(rune);
                if (category is UnicodeCategory.Control or
                    UnicodeCategory.LineSeparator or
                    UnicodeCategory.ParagraphSeparator or
                    UnicodeCategory.SpaceSeparator or
                    UnicodeCategory.PrivateUse or
                    UnicodeCategory.Surrogate or
                    UnicodeCategory.OtherNotAssigned)
                {
                    return null;
                }

                if (IsEmojiBase(rune.Value))
                {
                    containsEmojiBase = true;
                    continue;
                }

                if (rune.Value is 0xFE0F or 0x200D ||
                    rune.Value is >= 0x1F3FB and <= 0x1F3FF ||
                    rune.Value is >= 0xE0020 and <= 0xE007F)
                {
                    continue;
                }

                return null;
            }

            return containsEmojiBase ? normalized : null;
        }

        private static bool IsKeycapEmoji(IReadOnlyList<Rune> runes)
        {
            if (runes.Count is not (2 or 3) || runes[^1].Value != 0x20E3)
            {
                return false;
            }

            var key = runes[0].Value;
            var isKey = key is 0x23 or 0x2A || key is >= 0x30 and <= 0x39;
            return isKey && (runes.Count == 2 || runes[1].Value == 0xFE0F);
        }

        private static bool IsEmojiBase(int value)
        {
            return value is 0x00A9 or 0x00AE or 0x203C or 0x2049 or 0x2122 or 0x2139 or
                   0x3030 or 0x303D or 0x3297 or 0x3299 ||
                   value is >= 0x2190 and <= 0x21FF ||
                   value is >= 0x2300 and <= 0x23FF ||
                   value is >= 0x25A0 and <= 0x27BF ||
                   value is >= 0x2900 and <= 0x297F ||
                   value is >= 0x2B00 and <= 0x2BFF ||
                   value is >= 0x1F000 and <= 0x1FAFF;
        }
    }

    public enum MessageReactionMutationStatus
    {
        Success,
        InvalidEmoji,
        NotFound
    }

    public sealed record MessageReactionMutationResult(
        MessageReactionMutationStatus Status,
        SpaceMessageResponse? Message)
    {
        public static MessageReactionMutationResult Success(SpaceMessageResponse message) =>
            new(MessageReactionMutationStatus.Success, message);

        public static MessageReactionMutationResult InvalidEmoji() =>
            new(MessageReactionMutationStatus.InvalidEmoji, null);

        public static MessageReactionMutationResult NotFound() =>
            new(MessageReactionMutationStatus.NotFound, null);
    }
}
