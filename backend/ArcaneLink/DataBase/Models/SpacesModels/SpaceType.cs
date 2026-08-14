namespace ArcaneLink.DataBase.Models.SpacesModels
{
    public class SpaceType
    {
        public Guid Id { get; set; }
        public required string Code { get; set; }
        public required string Title { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }

        public ICollection<Space> Spaces { get; set; } = [];
    }
}
