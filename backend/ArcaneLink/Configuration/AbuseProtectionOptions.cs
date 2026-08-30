namespace ArcaneLink.Configuration;

public sealed class AbuseProtectionOptions
{
    public const string SectionName = "RateLimiting";

    public RateLimitRuleOptions Auth { get; set; } = new(30, 60);
    public RateLimitRuleOptions Uploads { get; set; } = new(20, 60);
    public RateLimitRuleOptions Invites { get; set; } = new(60, 60);
    public RateLimitRuleOptions DiscoverySearch { get; set; } = new(120, 60);
    public RateLimitRuleOptions SignalRConnect { get; set; } = new(30, 60);
    public RateLimitRuleOptions ModerationReports { get; set; } = new(10, 60);
    public RateLimitRuleOptions TurnCredentials { get; set; } = new(12, 60);

    public void Validate()
    {
        ValidateRule(nameof(this.Auth), this.Auth);
        ValidateRule(nameof(this.Uploads), this.Uploads);
        ValidateRule(nameof(this.Invites), this.Invites);
        ValidateRule(nameof(this.DiscoverySearch), this.DiscoverySearch);
        ValidateRule(nameof(this.SignalRConnect), this.SignalRConnect);
        ValidateRule(nameof(this.ModerationReports), this.ModerationReports);
        ValidateRule(nameof(this.TurnCredentials), this.TurnCredentials);
    }

    private static void ValidateRule(string name, RateLimitRuleOptions rule)
    {
        ArgumentNullException.ThrowIfNull(rule);

        if (rule.PermitLimit <= 0)
        {
            throw new InvalidOperationException(
                $"{SectionName}:{name}:PermitLimit must be greater than zero.");
        }

        if (rule.WindowSeconds <= 0)
        {
            throw new InvalidOperationException(
                $"{SectionName}:{name}:WindowSeconds must be greater than zero.");
        }
    }
}

public sealed class RateLimitRuleOptions
{
    public RateLimitRuleOptions()
    {
    }

    public RateLimitRuleOptions(int permitLimit, int windowSeconds)
    {
        this.PermitLimit = permitLimit;
        this.WindowSeconds = windowSeconds;
    }

    public int PermitLimit { get; set; }
    public int WindowSeconds { get; set; }
}

public static class AbuseRateLimitPolicyNames
{
    public const string Auth = "auth";
    public const string Uploads = "uploads";
    public const string Invites = "invites";
    public const string DiscoverySearch = "discovery-search";
    public const string SignalRConnect = "signalr-connect";
    public const string ModerationReports = "moderation-reports";
    public const string TurnCredentials = "turn-credentials";
}
