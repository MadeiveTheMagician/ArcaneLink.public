namespace ArcaneLink.Services.Notifications
{
    internal static class UserNotificationText
    {
        public const int PreviewMaxLength = 240;
        public const string InviteKind = "invite";
        public const string PrivateSpaceInviteKind = "private-space-invite";
        public const string FriendRequestKind = "friend-request";
        public const string MentionKind = "mention";
        public const string SystemKind = "system";
        public const string InviteTitle = "Приглашение на сервер";
        public const string PrivateSpaceInviteTitle = "Новая личная переписка";
        public const string FriendRequestTitle = "Новая заявка в друзья";
        public const string MentionTitle = "Упоминание";

        public static string PrivateSpaceInviteBody(string? spaceTitle) =>
            string.IsNullOrWhiteSpace(spaceTitle)
                ? "Вас добавили в личную переписку"
                : $"Вас добавили в личную переписку «{spaceTitle}»";

        public static string FriendRequestBody(string actorDisplayName) =>
            $"{actorDisplayName} хочет добавить вас в друзья";

        public static string MentionBody(string spaceTitle, string serverTitle) =>
            $"Вас упомянули в #{spaceTitle} на сервере «{serverTitle}»";

        public static string PrivateMentionBody(string? spaceTitle) =>
            string.IsNullOrWhiteSpace(spaceTitle)
                ? "Вас упомянули в личной переписке"
                : $"Вас упомянули в личной переписке «{spaceTitle}»";

        public static string CreatePreview(string value)
        {
            var normalized = string.Join(
                ' ',
                value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            if (normalized.Length <= PreviewMaxLength)
            {
                return normalized;
            }

            return $"{normalized[..(PreviewMaxLength - 1)]}…";
        }
    }
}
