namespace ArcaneLink.DataBase.DTOs.Streaming;

public sealed class StreamingConfigResponse
{
    public IReadOnlyDictionary<string, int> MaxBitrateByResolution { get; init; } =
        new Dictionary<string, int>();
}
