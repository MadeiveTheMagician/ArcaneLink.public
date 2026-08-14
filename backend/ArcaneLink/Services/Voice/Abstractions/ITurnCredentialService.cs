using ArcaneLink.DataBase.DTOs.Voice;

namespace ArcaneLink.Services.Voice.Abstractions;

public interface ITurnCredentialService
{
    bool IsAvailable { get; }
    VoiceIceServerResponse IssueForUser(Guid userId);
}
