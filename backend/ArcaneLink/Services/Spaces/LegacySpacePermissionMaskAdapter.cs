using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Services.Spaces
{
    /// <summary>
    /// Read-time compatibility bridge for the four legacy space ACL permissions.
    /// The persisted legacy rows remain authoritative until granular space ACL masks
    /// have their own storage model.
    /// </summary>
    public sealed class LegacySpacePermissionMaskAdapter
    {
        private static readonly IReadOnlyDictionary<Guid, PermissionMask256>
            CompatibilityMasks = new Dictionary<Guid, PermissionMask256>
            {
                [SpacePermissionIds.ViewSpace] = Mask(
                    "VIEW_TEXT_SPACES",
                    "VIEW_VOICE_SPACES",
                    "READ_MESSAGE_HISTORY",
                    "READ_VOICE_CHAT_HISTORY"),
                [SpacePermissionIds.SendMessages] = Mask(
                    "SEND_MESSAGES",
                    "SEND_MESSAGES_IN_VOICE_CHAT",
                    "SEND_LINKS",
                    "ATTACH_FILES",
                    "ADD_REACTIONS",
                    "MENTION_EVERYONE",
                    "MENTION_HERE"),
                [SpacePermissionIds.ConnectVoice] = Mask(
                    "CONNECT_VOICE",
                    "SPEAK_IN_VOICE",
                    "USE_VIDEO",
                    "SHARE_SCREEN"),
                [SpacePermissionIds.ManageSpace] = Mask(
                    "MANAGE_PINS",
                    "MANAGE_MESSAGES",
                    "MUTE_VOICE_MEMBERS",
                    "DEAFEN_VOICE_MEMBERS",
                    "MOVE_VOICE_MEMBERS",
                    "DISCONNECT_VOICE_MEMBERS",
                    "MANAGE_SPACE_SETTINGS",
                    "MANAGE_SPACE_ACCESS",
                    "REORDER_SPACES_AND_CATEGORIES",
                    "CREATE_PUBLIC_CATEGORIES",
                    "CREATE_PUBLIC_TEXT_SPACES",
                    "CREATE_PUBLIC_VOICE_SPACES",
                    "CREATE_PRIVATE_CATEGORIES",
                    "CREATE_PRIVATE_TEXT_SPACES",
                    "CREATE_PRIVATE_VOICE_SPACES",
                    "DELETE_CATEGORIES",
                    "DELETE_TEXT_SPACES",
                    "DELETE_VOICE_SPACES")
            };

        public bool TryCreateMask(
            Guid legacyPermissionId,
            out PermissionMask256 mask)
        {
            return CompatibilityMasks.TryGetValue(legacyPermissionId, out mask);
        }

        public bool TryGetLegacyGate(
            string permissionCode,
            out SpaceAction action)
        {
            action = SpaceAction.View;
            if (!ServerPermissionRegistry.TryGet(permissionCode, out _))
            {
                return false;
            }

            action = permissionCode switch
            {
                "SEND_MESSAGES" or
                "SEND_MESSAGES_IN_VOICE_CHAT" or
                "SEND_LINKS" or
                "ATTACH_FILES" or
                "ADD_REACTIONS" or
                "MENTION_EVERYONE" or
                "MENTION_HERE" => SpaceAction.Send,

                "CONNECT_VOICE" or
                "SPEAK_IN_VOICE" or
                "USE_VIDEO" or
                "SHARE_SCREEN" => SpaceAction.Connect,

                _ => SpaceAction.View
            };
            return true;
        }

        private static PermissionMask256 Mask(params string[] permissionCodes)
        {
            return ServerPermissionRegistry.CreateMask(permissionCodes);
        }
    }
}
