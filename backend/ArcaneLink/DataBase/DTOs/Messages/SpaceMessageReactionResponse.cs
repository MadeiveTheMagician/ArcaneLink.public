namespace ArcaneLink.DataBase.DTOs.Messages;

public class SpaceMessageReactionResponse
{
    public string EmojiCode { get; set; } = "";
    public int Count { get; set; }
    public bool ReactedByCurrentUser { get; set; }
}
