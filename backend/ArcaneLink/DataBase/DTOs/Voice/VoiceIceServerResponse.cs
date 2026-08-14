namespace ArcaneLink.DataBase.DTOs.Voice;

public sealed class VoiceIceServerResponse
{
    public required IReadOnlyList<VoiceIceServer> IceServers { get; init; }
    public string IceTransportPolicy { get; init; } = "relay";
    public DateTimeOffset ExpiresAt { get; init; }
}

public sealed class VoiceIceServer
{
    public required IReadOnlyList<string> Urls { get; init; }
    public required string Username { get; init; }
    public required string Credential { get; init; }
    public string CredentialType { get; init; } = "password";
}
