namespace ArcaneLink.DataBase.DTOs.Spaces;

public class SpacePositionRequest
{
    public Guid SpaceId { get; set; }
    public Guid? ParentSpaceId { get; set; }
    public int Position { get; set; }
}
