using ArcaneLink.DataBase.Constants;

namespace ArcaneLink.Services.Realtime;

public sealed record UserPresenceChanged(
    Guid UserId,
    string PresenceStatus,
    DateTime? LastSeenAt,
    DateTime ChangedAt);

public sealed record UserPresenceConfiguration(
    string Visibility,
    bool ShowLastSeen,
    string Mode)
{
    public static UserPresenceConfiguration Create(
        string? visibility,
        bool showLastSeen,
        string? mode)
    {
        return new UserPresenceConfiguration(
            PresenceVisibilityCodes.Normalize(visibility)
                ?? PresenceVisibilityCodes.Nobody,
            showLastSeen,
            PresenceModeCodes.Normalize(mode)
                ?? PresenceModeCodes.Invisible);
    }
}

public readonly record struct UserPresenceTopologyKey(
    string Scope,
    Guid ResourceId)
{
    public static UserPresenceTopologyKey Server(Guid serverId) =>
        new("server", serverId);

    public static UserPresenceTopologyKey PrivateSpace(Guid spaceId) =>
        new("private-space", spaceId);
}

public sealed class UserPresenceAudienceSnapshot
{
    private static readonly IReadOnlySet<Guid> EmptyRecipients =
        new HashSet<Guid>();

    public static UserPresenceAudienceSnapshot Empty { get; } =
        new(
            EmptyRecipients,
            EmptyRecipients,
            EmptyRecipients,
            EmptyRecipients,
            EmptyRecipients);

    public UserPresenceAudienceSnapshot(
        IReadOnlySet<Guid> selfRecipients,
        IReadOnlySet<Guid> friendRecipients,
        IReadOnlySet<Guid> friendsOfFriendsRecipients,
        IReadOnlySet<Guid> sharedServerRecipients,
        IReadOnlySet<Guid> everyoneRecipients)
    {
        this.SelfRecipients = selfRecipients;
        this.FriendRecipients = friendRecipients;
        this.FriendsOfFriendsRecipients = friendsOfFriendsRecipients;
        this.SharedServerRecipients = sharedServerRecipients;
        this.EveryoneRecipients = everyoneRecipients;
    }

    public IReadOnlySet<Guid> SelfRecipients { get; }
    public IReadOnlySet<Guid> FriendRecipients { get; }
    public IReadOnlySet<Guid> FriendsOfFriendsRecipients { get; }
    public IReadOnlySet<Guid> SharedServerRecipients { get; }
    public IReadOnlySet<Guid> EveryoneRecipients { get; }

    public IReadOnlySet<Guid> GetRecipients(string? visibility)
    {
        var policy = PresenceVisibilityCodes.ParseOrNobody(visibility);
        if (policy.AllowsEveryone)
        {
            return this.EveryoneRecipients;
        }

        var recipients = new HashSet<Guid>(this.SelfRecipients);
        if (policy.AllowsFriends)
        {
            recipients.UnionWith(this.FriendRecipients);
        }
        if (policy.AllowsFriendsOfFriends)
        {
            recipients.UnionWith(this.FriendsOfFriendsRecipients);
        }
        if (policy.AllowsSharedServers)
        {
            recipients.UnionWith(this.SharedServerRecipients);
        }

        return recipients;
    }
}
