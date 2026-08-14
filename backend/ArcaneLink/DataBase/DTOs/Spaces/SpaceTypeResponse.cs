namespace ArcaneLink.DataBase.DTOs.Spaces
{
    public class SpaceTypeResponse
    {
        public Guid Id { get; set; }
        public string Code { get; set; } = "";
        public string Title { get; set; } = "";
        public string? Description { get; set; }
    }
}
