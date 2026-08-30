namespace ArcaneLink.DataBase.DTOs.Users;

public class SubscriptionTypeResponse
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public string Title { get; set; } = null!;

    public int Rank { get; set; }
}
