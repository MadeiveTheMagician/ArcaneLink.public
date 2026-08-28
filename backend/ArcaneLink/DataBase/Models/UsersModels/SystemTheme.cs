namespace ArcaneLink.DataBase.Models.UsersModels;

public class SystemTheme
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string DominantColor { get; set; } = string.Empty;
    public string CssVariablesJson { get; set; } = "{}";
    public bool IsDefault { get; set; }
    public int DisplayOrder { get; set; }

    public ICollection<UserProfileSettings> ProfileSettings { get; set; } = [];
}
