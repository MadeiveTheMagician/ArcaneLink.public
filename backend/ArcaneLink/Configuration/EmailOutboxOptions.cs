namespace ArcaneLink.Configuration;

public sealed class EmailOutboxOptions
{
    public const string SectionName = "EmailOutbox";

    public int PollIntervalSeconds { get; set; } = 5;
    public int LeaseSeconds { get; set; } = 120;
    public int MaxAttempts { get; set; } = 8;
    public int MaxBackoffMinutes { get; set; } = 60;

    public bool IsValid() =>
        PollIntervalSeconds is >= 1 and <= 300 &&
        LeaseSeconds is >= 30 and <= 3600 &&
        MaxAttempts is >= 1 and <= 25 &&
        MaxBackoffMinutes is >= 1 and <= 1440;
}
