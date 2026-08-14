namespace ArcaneLink.DataBase.DTOs.Messages
{
    public class SpaceMessageMentionResponse
    {
        public Guid Id { get; set; }
        public required string Kind { get; set; }
        public Guid? TargetUserId { get; set; }
        public Guid? TargetRoleId { get; set; }
        public required string DisplayText { get; set; }
        public int Start { get; set; }
        public int Length { get; set; }
    }
}
