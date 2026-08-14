namespace ArcaneLink.DataBase.DTOs.Spaces
{
    public class ReorderSpacesRequest
    {
        public IReadOnlyList<SpacePositionRequest> Spaces { get; set; } = [];
    }
}
