namespace ArcaneLink.DataBase.DTOs.Messages;

public class PrivateSpaceTrashMessageResponse
{
    public SpaceMessageResponse Message { get; set; } = null!;
    public string Scope { get; set; } = "";
    public DateTime DeletedAt { get; set; }
    public DateTime RestoreUntil { get; set; }
}
