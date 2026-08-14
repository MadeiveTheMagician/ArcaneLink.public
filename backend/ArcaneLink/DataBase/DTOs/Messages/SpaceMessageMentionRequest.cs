namespace ArcaneLink.DataBase.DTOs.Messages
{
    public class SpaceMessageMentionRequest
    {
        public required string Kind { get; set; }
        public Guid? TargetId { get; set; }
        public int Start { get; set; }
        public int Length { get; set; }
    }
}
