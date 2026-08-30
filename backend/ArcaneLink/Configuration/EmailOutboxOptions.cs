namespace ArcaneLink.Configuration;

public sealed class EmailOutboxOptions
{
    public const string SectionName = "EmailOutbox";

    public int PollIntervalSeconds { get; set; } = 5;
    public int LeaseSeconds { get; set; } = 120;
    public int MaxAttempts { get; set; } = 8;
    public int MaxBackoffMinutes { get; set; } = 60;

    public bool IsValid() =>
        this.PollIntervalSeconds is >= 1 and <= 300 &&
        this.LeaseSeconds is >= 30 and <= 3600 &&
        this.MaxAttempts is >= 1 and <= 25 &&
        this.MaxBackoffMinutes is >= 1 and <= 1440;
}
