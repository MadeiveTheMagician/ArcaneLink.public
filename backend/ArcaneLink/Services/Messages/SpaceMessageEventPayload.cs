using System.Text.Json;

namespace ArcaneLink.Services.Messages;

internal static class SpaceMessageEventPayload
{
    internal const string MessagePinnedKind = "message_pinned";

    internal static string CreateMessagePinned(Guid messageId)
    {
        return JsonSerializer.Serialize(new
        {
            kind = MessagePinnedKind,
            messageId
        });
    }
}
