using ArcaneLink.DataBase.Constants;

namespace ArcaneLink.Services.Users;

public sealed record UserPresenceSnapshot(
    string PresenceStatus,
    DateTime? LastSeenAt)
{
    public static UserPresenceSnapshot Hidden { get; } =
        new(PresenceStatusCodes.Offline, null);
}
