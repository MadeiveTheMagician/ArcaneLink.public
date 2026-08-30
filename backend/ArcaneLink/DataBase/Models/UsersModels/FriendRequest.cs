namespace ArcaneLink.DataBase.Models.UsersModels;

public class FriendRequest
{
    public Guid Id { get; set; }

    public Guid FromUserId { get; set; }
    public User FromUser { get; set; } = null!;

    public Guid ToUserId { get; set; }
    public User ToUser { get; set; } = null!;

    public Guid StatusId { get; set; }
    public FriendRequestStatus Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}
