namespace ArcaneLink.Services.Streaming;

public sealed class StreamingOptions
{
    public const string SectionName = "Streaming";

    public Dictionary<string, int> MaxBitrateByResolution { get; set; } =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["480p"] = 1_200_000,
            ["720p"] = 2_800_000,
            ["1080p"] = 5_500_000,
            ["1440p"] = 10_000_000,
            ["4k"] = 22_000_000,
            ["source"] = 28_000_000
        };
}
