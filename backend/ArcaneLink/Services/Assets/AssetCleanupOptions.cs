namespace ArcaneLink.Services.Assets;

public sealed class AssetCleanupOptions
{
    public const string SectionName = "AssetCleanup";

    public bool Enabled { get; set; } = true;
    public bool DryRun { get; set; } = true;
    public int RetentionDays { get; set; } = 7;
    public int IntervalMinutes { get; set; } = 60;
    public int BatchSize { get; set; } = 100;
}
