namespace ArcaneLink.Configuration;

public sealed class RealtimePresenceOptions
{
    public const string SectionName = "RealtimePresence";

    public int DisconnectGraceSeconds { get; set; } = 20;
}
