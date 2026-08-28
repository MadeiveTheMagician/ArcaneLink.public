namespace ArcaneLink.DataBase.Models.UsersModels;

public class UserStatus
{
    public Guid Id { get; set; }
    public string Code { get; set; } = null!; // active, banned, deleted
    public string Title { get; set; } = null!; // Активный, Заблокированный, Удаленный
}
