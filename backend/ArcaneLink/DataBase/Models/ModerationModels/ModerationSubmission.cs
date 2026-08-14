using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ModerationModels
{
    public class ModerationSubmission
    {
        public Guid Id { get; set; }
        public Guid CaseId { get; set; }
        public ModerationCase Case { get; set; } = null!;
        public Guid ReporterUserId { get; set; }
        public User ReporterUser { get; set; } = null!;
        public required string ReasonCode { get; set; }
        public string? Details { get; set; }
        public DateTime SubmittedAt { get; set; }
        public ModerationEvidence Evidence { get; set; } = null!;
    }
}
