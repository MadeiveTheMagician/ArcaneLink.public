namespace ArcaneLink.DataBase.Constants
{
    public static class PresenceVisibilityCodes
    {
        public const string Everyone = "everyone";
        public const string Friends = "friends";
        public const string FriendsOfFriends = "friends_of_friends";
        public const string SharedServers = "shared_servers";
        public const string Nobody = "nobody";
        public const string CustomPrefix = "custom:";

        private static readonly string[] CustomCategoryOrder =
        [
            Friends,
            FriendsOfFriends,
            SharedServers
        ];

        public static string? Normalize(string? value)
        {
            var normalized = value?.Trim().ToLowerInvariant();

            if (normalized is Everyone or Friends or Nobody)
            {
                return normalized;
            }
            if (normalized == null ||
                !normalized.StartsWith(
                    CustomPrefix,
                    StringComparison.Ordinal))
            {
                return null;
            }

            var categories = normalized[CustomPrefix.Length..]
                .Split(
                    ',',
                    StringSplitOptions.RemoveEmptyEntries |
                    StringSplitOptions.TrimEntries);
            var categorySet = categories.ToHashSet(
                StringComparer.Ordinal);
            if (categories.Length == 0 ||
                categorySet.Count != categories.Length ||
                categorySet.Any(category =>
                    !CustomCategoryOrder.Contains(
                        category,
                        StringComparer.Ordinal)))
            {
                return null;
            }

            return CustomPrefix + string.Join(
                ',',
                CustomCategoryOrder.Where(category =>
                    categorySet.Contains(category)));
        }

        public static PresenceVisibilityPolicy ParseOrNobody(
            string? value)
        {
            var normalized = Normalize(value);
            return normalized switch
            {
                Everyone => new PresenceVisibilityPolicy(
                    AllowsEveryone: true,
                    AllowsFriends: true,
                    AllowsFriendsOfFriends: true,
                    AllowsSharedServers: true),
                Friends => new PresenceVisibilityPolicy(
                    AllowsEveryone: false,
                    AllowsFriends: true,
                    AllowsFriendsOfFriends: false,
                    AllowsSharedServers: false),
                Nobody or null => PresenceVisibilityPolicy.Nobody,
                _ => ParseCustom(normalized)
            };
        }

        private static PresenceVisibilityPolicy ParseCustom(
            string normalized)
        {
            var categories = normalized[CustomPrefix.Length..]
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .ToHashSet(StringComparer.Ordinal);
            return new PresenceVisibilityPolicy(
                AllowsEveryone: false,
                AllowsFriends: categories.Contains(Friends),
                AllowsFriendsOfFriends:
                    categories.Contains(FriendsOfFriends),
                AllowsSharedServers:
                    categories.Contains(SharedServers));
        }
    }

    public readonly record struct PresenceVisibilityPolicy(
        bool AllowsEveryone,
        bool AllowsFriends,
        bool AllowsFriendsOfFriends,
        bool AllowsSharedServers)
    {
        public static PresenceVisibilityPolicy Nobody => new(
            AllowsEveryone: false,
            AllowsFriends: false,
            AllowsFriendsOfFriends: false,
            AllowsSharedServers: false);
    }

    public static class PresenceModeCodes
    {
        public const string Automatic = "automatic";
        public const string Invisible = "invisible";

        public static string? Normalize(string? value)
        {
            var normalized = value?.Trim().ToLowerInvariant();

            return normalized is Automatic or Invisible
                ? normalized
                : null;
        }
    }

    public static class PresenceStatusCodes
    {
        public const string Online = "online";
        public const string Offline = "offline";
    }
}
