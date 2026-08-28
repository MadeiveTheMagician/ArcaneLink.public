namespace ArcaneLink.DataBase.Constants;

public static class DirectMessagePrivacyCodes
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

        if (normalized is Everyone or Friends or SharedServers or Nobody)
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

    public static DirectMessagePrivacyPolicy ParseOrNobody(
        string? value)
    {
        var normalized = Normalize(value);
        return normalized switch
        {
            Everyone => new DirectMessagePrivacyPolicy(
                AllowsEveryone: true,
                AllowsFriends: true,
                AllowsFriendsOfFriends: true,
                AllowsSharedServers: true),
            Friends => new DirectMessagePrivacyPolicy(
                AllowsEveryone: false,
                AllowsFriends: true,
                AllowsFriendsOfFriends: false,
                AllowsSharedServers: false),
            SharedServers => new DirectMessagePrivacyPolicy(
                AllowsEveryone: false,
                AllowsFriends: false,
                AllowsFriendsOfFriends: false,
                AllowsSharedServers: true),
            Nobody or null => DirectMessagePrivacyPolicy.Nobody,
            _ => ParseCustom(normalized)
        };
    }

    private static DirectMessagePrivacyPolicy ParseCustom(
        string normalized)
    {
        var categories = normalized[CustomPrefix.Length..]
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .ToHashSet(StringComparer.Ordinal);
        return new DirectMessagePrivacyPolicy(
            AllowsEveryone: false,
            AllowsFriends: categories.Contains(Friends),
            AllowsFriendsOfFriends:
                categories.Contains(FriendsOfFriends),
            AllowsSharedServers:
                categories.Contains(SharedServers));
    }
}

public readonly record struct DirectMessagePrivacyPolicy(
    bool AllowsEveryone,
    bool AllowsFriends,
    bool AllowsFriendsOfFriends,
    bool AllowsSharedServers)
{
    public static DirectMessagePrivacyPolicy Nobody => new(
        AllowsEveryone: false,
        AllowsFriends: false,
        AllowsFriendsOfFriends: false,
        AllowsSharedServers: false);
}
