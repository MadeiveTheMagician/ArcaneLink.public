namespace ArcaneLink.DataBase.Constants;

public static class ServerAccessModeCodes
{
    public const string Public = "public";
    public const string Restricted = "restricted";
    public const string Private = "private";

    public static IReadOnlySet<string> All { get; } =
        new HashSet<string>(StringComparer.Ordinal)
        {
            Public,
            Restricted,
            Private
        };
}

public static class ServerJoinRequestStatusCodes
{
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Declined = "declined";
    public const string Cancelled = "cancelled";
}

public static class ServerJoinActionCodes
{
    public const string Join = "join";
    public const string Request = "request";
    public const string Pending = "pending";
    public const string None = "none";
}

public static class ServerJoinResultStatusCodes
{
    public const string Joined = "joined";
    public const string Pending = "pending";
}
