using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.MessagesModels;

public class SpaceMessage
{
    public Guid Id { get; set; }

    public Guid SpaceId { get; set; }
    public Space Space { get; set; } = null!;

    public Guid SenderUserId { get; set; }
    public User SenderUser { get; set; } = null!;

    public Guid MessageTypeId { get; set; }
    public SpaceMessageType MessageType { get; set; } = null!;

    public string? Body { get; set; }
    public string? Payload { get; set; }

    public Guid? ReplyToMessageId { get; set; }
    public SpaceMessage? ReplyToMessage { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedByUserId { get; set; }

    public ICollection<SpaceMessage> Replies { get; set; } = [];
    public ICollection<SpaceMessageAsset> Assets { get; set; } = [];
    public ICollection<SpaceMessageReaction> Reactions { get; set; } = [];
    public ICollection<SpaceMessageMention> Mentions { get; set; } = [];
    public ICollection<PrivateMessageRecipient> Recipients { get; set; } = [];
    public ICollection<SpaceMessageUserDeletion> UserDeletions { get; set; } = [];
}
