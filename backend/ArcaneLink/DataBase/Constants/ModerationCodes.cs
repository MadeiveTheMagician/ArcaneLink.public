namespace ArcaneLink.DataBase.Constants;

public static class ModerationCaseStatuses
{
    public const string Open = "open";
    public const string InReview = "in_review";
    public const string Resolved = "resolved";
    public const string Dismissed = "dismissed";

    public static IReadOnlySet<string> All { get; } = new HashSet<string>(
        [Open, InReview, Resolved, Dismissed],
        StringComparer.Ordinal);
}

public static class ModerationReasonCodes
{
    public const string Spam = "spam";
    public const string Harassment = "harassment";
    public const string Hate = "hate";
    public const string Sexual = "sexual";
    public const string Violence = "violence";
    public const string Scam = "scam";
    public const string Privacy = "privacy";
    public const string Other = "other";

    public static IReadOnlySet<string> All { get; } = new HashSet<string>(
        [Spam, Harassment, Hate, Sexual, Violence, Scam, Privacy, Other],
        StringComparer.Ordinal);
}
