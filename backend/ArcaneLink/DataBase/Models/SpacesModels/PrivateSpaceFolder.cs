using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.SpacesModels;

public class PrivateSpaceFolder
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string Name { get; set; }
    public required string Icon { get; set; }
    public string? Color { get; set; }
    public int Position { get; set; }
    public bool IsOrderLocked { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<PrivateSpaceFolderItem> Items { get; set; } = [];
}
