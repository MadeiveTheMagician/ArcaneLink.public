namespace ArcaneLink.DataBase.Models.ModerationModels
{
    public class ModerationEvidence
    {
        public Guid Id { get; set; }
        public Guid SubmissionId { get; set; }
        public ModerationSubmission Submission { get; set; } = null!;
        public string? BodyExcerpt { get; set; }
        public string? PayloadExcerpt { get; set; }
        public required string CanonicalContentSha256 { get; set; }
        public DateTime MessageCreatedAt { get; set; }
        public DateTime MessageUpdatedAt { get; set; }
        public DateTime? MessageEditedAt { get; set; }
        public DateTime CapturedAt { get; set; }
        public ICollection<ModerationEvidenceAsset> Assets { get; set; } = [];
    }
}
