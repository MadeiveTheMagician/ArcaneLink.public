using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Messages
{
    public class SpaceMessageAccessService
    {
        private const string ViewTextSpaces = "VIEW_TEXT_SPACES";
        private const string ViewVoiceSpaces = "VIEW_VOICE_SPACES";
        private const string ReadMessageHistory = "READ_MESSAGE_HISTORY";
        private const string ReadVoiceChatHistory = "READ_VOICE_CHAT_HISTORY";
        private const string SendMessages = "SEND_MESSAGES";
        private const string SendMessagesInVoiceChat = "SEND_MESSAGES_IN_VOICE_CHAT";
        private const string SendLinks = "SEND_LINKS";
        private const string AttachFiles = "ATTACH_FILES";
        private const string AddReactions = "ADD_REACTIONS";
        private const string MentionEveryone = "MENTION_EVERYONE";
        private const string ManagePins = "MANAGE_PINS";
        private const string ManageMessages = "MANAGE_MESSAGES";

        private readonly AppDbContext _db;
        private readonly ISpaceAuthorizationService _authorization;

        public SpaceMessageAccessService(
            AppDbContext db,
            ISpaceAuthorizationService authorization)
        {
            this._db = db;
            this._authorization = authorization;
        }

        public async Task<Space?> GetAccessibleMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            SpaceAction action,
            CancellationToken cancellationToken)
        {
            var capabilities = await this._authorization.GetCapabilitiesAsync(
                userId,
                serverId,
                spaceId,
                cancellationToken);
            if (!Can(capabilities, action))
            {
                return null;
            }

            return await this._db.Spaces
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == spaceId &&
                         x.ServerId == serverId &&
                         (x.TypeId == SpaceIds.TypeTextRoom ||
                          x.TypeId == SpaceIds.TypeVoiceRoom) &&
                         x.DeletedAt == null,
                    cancellationToken);
        }

        public async Task<IReadOnlyList<Guid>?> GetAccessibleMessageSpaceIdsAsync(
            Guid userId,
            Guid serverId,
            SpaceAction action,
            CancellationToken cancellationToken)
        {
            var spaceIds = await this._authorization.GetAllowedSpaceIdsAsync(
                userId,
                serverId,
                action,
                cancellationToken);
            if (spaceIds == null)
            {
                return null;
            }

            return await this._db.Spaces
                .AsNoTracking()
                .Where(
                    x => spaceIds.Contains(x.Id) &&
                         x.ServerId == serverId &&
                         (x.TypeId == SpaceIds.TypeTextRoom ||
                          x.TypeId == SpaceIds.TypeVoiceRoom) &&
                         x.DeletedAt == null)
                .OrderBy(x => x.Position)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        public Task<Space?> GetViewableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.View,
                static space => GetViewPermissionCode(space),
                static _ => [],
                cancellationToken);

        public Task<Space?> GetReadableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.View,
                static space => GetHistoryPermissionCode(space),
                static space => [GetViewPermissionCode(space)],
                cancellationToken);

        public Task<Space?> GetWritableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.Send,
                static space => GetSendPermissionCode(space),
                static space => [GetViewPermissionCode(space)],
                cancellationToken);

        public Task<Space?> GetAttachableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.Send,
                static _ => AttachFiles,
                static space =>
                [
                    GetViewPermissionCode(space),
                    GetSendPermissionCode(space)
                ],
                cancellationToken);

        public Task<Space?> GetLinkWritableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.Send,
                static _ => SendLinks,
                static space =>
                [
                    GetViewPermissionCode(space),
                    GetSendPermissionCode(space)
                ],
                cancellationToken);

        public Task<Space?> GetReactableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.Send,
                static _ => AddReactions,
                static space =>
                [
                    GetViewPermissionCode(space),
                    GetHistoryPermissionCode(space)
                ],
                cancellationToken);

        public Task<Space?> GetEveryoneMentionableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.Send,
                static _ => MentionEveryone,
                static space =>
                [
                    GetViewPermissionCode(space),
                    GetSendPermissionCode(space)
                ],
                cancellationToken);

        public Task<Space?> GetPinnableMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken) =>
            this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.View,
                static _ => ManagePins,
                static space =>
                [
                    GetViewPermissionCode(space),
                    GetHistoryPermissionCode(space)
                ],
                cancellationToken);

        public async Task<IReadOnlyList<Guid>?> GetReadableMessageSpaceIdsAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var spaceIds = await this.GetAccessibleMessageSpaceIdsAsync(
                userId,
                serverId,
                SpaceAction.View,
                cancellationToken);
            if (spaceIds == null)
            {
                return null;
            }

            var spaces = await this._db.Spaces
                .AsNoTracking()
                .Where(space => spaceIds.Contains(space.Id))
                .OrderBy(space => space.Position)
                .ToListAsync(cancellationToken);
            var readableSpaceIds = new List<Guid>(spaces.Count);
            foreach (var space in spaces)
            {
                if (await this.IsGranularAllowedAsync(
                        userId,
                        serverId,
                        space,
                        GetHistoryPermissionCode(space),
                        [GetViewPermissionCode(space)],
                        cancellationToken))
                {
                    readableSpaceIds.Add(space.Id);
                }
            }

            return readableSpaceIds;
        }

        public Task<IReadOnlyList<Guid>> FilterViewableMessageUserIdsAsync(
            Guid serverId,
            Guid spaceId,
            IEnumerable<Guid> userIds,
            CancellationToken cancellationToken) =>
            this.FilterGranularMessageUserIdsAsync(
                serverId,
                spaceId,
                userIds,
                static space => GetViewPermissionCode(space),
                static _ => [],
                cancellationToken);

        public Task<IReadOnlyList<Guid>> FilterReadableMessageUserIdsAsync(
            Guid serverId,
            Guid spaceId,
            IEnumerable<Guid> userIds,
            CancellationToken cancellationToken) =>
            this.FilterGranularMessageUserIdsAsync(
                serverId,
                spaceId,
                userIds,
                static space => GetHistoryPermissionCode(space),
                static space => [GetViewPermissionCode(space)],
                cancellationToken);

        private async Task<IReadOnlyList<Guid>> FilterGranularMessageUserIdsAsync(
            Guid serverId,
            Guid spaceId,
            IEnumerable<Guid> userIds,
            Func<Space, string> permissionCode,
            Func<Space, IReadOnlyList<string>> dependencyCodes,
            CancellationToken cancellationToken)
        {
            var candidates = await this._authorization.FilterAuthorizedUserIdsAsync(
                serverId,
                spaceId,
                userIds,
                SpaceAction.View,
                cancellationToken);
            if (candidates.Count == 0)
            {
                return [];
            }

            var space = await this.LoadMessageSpaceAsync(
                serverId,
                spaceId,
                cancellationToken);
            if (space == null)
            {
                return [];
            }

            var allowed = new List<Guid>(candidates.Count);
            foreach (var userId in candidates)
            {
                if (await this.IsGranularAllowedAsync(
                        userId,
                        serverId,
                        space,
                        permissionCode(space),
                        dependencyCodes(space),
                        cancellationToken))
                {
                    allowed.Add(userId);
                }
            }

            return allowed;
        }

        public async Task<bool> CanMutateMessageAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            Guid senderUserId,
            CancellationToken cancellationToken)
        {
            if (userId == senderUserId)
            {
                return await this.GetWritableMessageSpaceAsync(
                    userId,
                    serverId,
                    spaceId,
                    cancellationToken) != null;
            }

            return await this.GetGranularMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                SpaceAction.View,
                static _ => ManageMessages,
                static space =>
                [
                    GetViewPermissionCode(space),
                    GetHistoryPermissionCode(space)
                ],
                cancellationToken) != null;
        }

        public async Task<bool> CanEditMessageAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            Guid senderUserId,
            CancellationToken cancellationToken)
        {
            if (userId != senderUserId)
            {
                return false;
            }

            return await this.GetWritableMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                cancellationToken) != null;
        }

        public async Task<bool> CanManageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var capabilities = await this._authorization.GetCapabilitiesAsync(
                userId,
                serverId,
                spaceId,
                cancellationToken);
            return capabilities?.CanManage == true;
        }

        private static bool Can(
            SpaceAccessCapabilities? capabilities,
            SpaceAction action)
        {
            if (capabilities == null)
            {
                return false;
            }

            return action switch
            {
                SpaceAction.View => capabilities.CanView,
                SpaceAction.Send => capabilities.CanSendMessages,
                SpaceAction.Connect => capabilities.CanConnectVoice,
                SpaceAction.Manage => capabilities.CanManage,
                _ => false
            };
        }

        private async Task<Space?> GetGranularMessageSpaceAsync(
            Guid userId,
            Guid serverId,
            Guid spaceId,
            SpaceAction legacyAction,
            Func<Space, string> permissionCode,
            Func<Space, IReadOnlyList<string>> dependencyCodes,
            CancellationToken cancellationToken)
        {
            var space = await this.GetAccessibleMessageSpaceAsync(
                userId,
                serverId,
                spaceId,
                legacyAction,
                cancellationToken);
            if (space == null)
            {
                return null;
            }

            return await this.IsGranularAllowedAsync(
                userId,
                serverId,
                space,
                permissionCode(space),
                dependencyCodes(space),
                cancellationToken)
                ? space
                : null;
        }

        private Task<bool> IsGranularAllowedAsync(
            Guid userId,
            Guid serverId,
            Space space,
            string permissionCode,
            IReadOnlyList<string> dependencyCodes,
            CancellationToken cancellationToken)
        {
            return this._authorization.IsAllowedAsync(
                userId,
                serverId,
                space.Id,
                new SpaceAuthorizationRequirement(
                    permissionCode,
                    DependencyCodes: dependencyCodes),
                cancellationToken);
        }

        private Task<Space?> LoadMessageSpaceAsync(
            Guid serverId,
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            return this._db.Spaces
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    space =>
                        space.Id == spaceId &&
                        space.ServerId == serverId &&
                        (space.TypeId == SpaceIds.TypeTextRoom ||
                         space.TypeId == SpaceIds.TypeVoiceRoom) &&
                        space.DeletedAt == null,
                    cancellationToken);
        }

        private static bool IsVoiceChat(Space space) =>
            space.TypeId == SpaceIds.TypeVoiceRoom ||
            space.ParentVoiceSpaceId.HasValue;

        private static string GetViewPermissionCode(Space space) =>
            IsVoiceChat(space) ? ViewVoiceSpaces : ViewTextSpaces;

        private static string GetHistoryPermissionCode(Space space) =>
            IsVoiceChat(space) ? ReadVoiceChatHistory : ReadMessageHistory;

        private static string GetSendPermissionCode(Space space) =>
            IsVoiceChat(space) ? SendMessagesInVoiceChat : SendMessages;
    }
}
