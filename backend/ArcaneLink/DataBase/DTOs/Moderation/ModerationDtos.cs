using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Moderation
{
    public sealed class CreateModerationReportRequest
    {
        [Required]
        [MaxLength(32)]
        public string ReasonCode { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Details { get; set; }
    }

    public sealed class ModerationReportResponse
    {
        public Guid ReportId { get; set; }
        public Guid ServerId { get; set; }
        public Guid SpaceId { get; set; }
        public Guid MessageId { get; set; }
        public string ReasonCode { get; set; } = string.Empty;
        public string? Details { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime SubmittedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public sealed class ModerationCaseCursorResponse
    {
        public DateTime UpdatedAt { get; set; }
        public Guid Id { get; set; }
    }

    public sealed class ModerationCasePageResponse
    {
        public IReadOnlyList<ModerationCaseSummaryResponse> Items { get; set; } = [];
        public ModerationCaseCursorResponse? NextCursor { get; set; }
    }

    public sealed class ModerationCaseSummaryResponse
    {
        public Guid CaseId { get; set; }
        public Guid ServerId { get; set; }
        public Guid SpaceId { get; set; }
        public Guid MessageId { get; set; }
        public Guid ReportedUserId { get; set; }
        public string ReportedUserDisplayName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int SubmissionCount { get; set; }
        public IReadOnlyList<string> ReasonCodes { get; set; } = [];
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public sealed class ModerationCaseDetailResponse
    {
        public Guid CaseId { get; set; }
        public Guid ServerId { get; set; }
        public Guid SpaceId { get; set; }
        public Guid MessageId { get; set; }
        public Guid ReportedUserId { get; set; }
        public string ReportedUserDisplayName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public IReadOnlyList<ModerationEvidenceResponse> Evidence { get; set; } = [];
        public IReadOnlyList<ModerationCaseActionResponse> Actions { get; set; } = [];
    }

    public sealed class ModerationEvidenceResponse
    {
        public Guid EvidenceId { get; set; }
        public string ReasonCode { get; set; } = string.Empty;
        public string? Details { get; set; }
        public DateTime SubmittedAt { get; set; }
        public string? BodyExcerpt { get; set; }
        public string? PayloadExcerpt { get; set; }
        public string ContentSha256 { get; set; } = string.Empty;
        public DateTime MessageCreatedAt { get; set; }
        public DateTime MessageUpdatedAt { get; set; }
        public DateTime? MessageEditedAt { get; set; }
        public DateTime CapturedAt { get; set; }
        public IReadOnlyList<ModerationEvidenceAssetResponse> Assets { get; set; } = [];
    }

    public sealed class ModerationEvidenceAssetResponse
    {
        public Guid EvidenceAssetId { get; set; }
        public int DisplayOrder { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string MimeType { get; set; } = string.Empty;
        public long SizeBytes { get; set; }
        public string Sha256 { get; set; } = string.Empty;
        public int? Width { get; set; }
        public int? Height { get; set; }
        public bool IsSpoiler { get; set; }
        public DateTime CreatedAt { get; set; }
        public string ContentUrl { get; set; } = string.Empty;
    }

    public sealed class ModerationCaseActionResponse
    {
        public Guid ActionId { get; set; }
        public string FromStatus { get; set; } = string.Empty;
        public string ToStatus { get; set; } = string.Empty;
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public sealed class UpdateModerationCaseRequest
    {
        [Required]
        [MaxLength(16)]
        public string Status { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Note { get; set; }

        public DateTime ExpectedUpdatedAt { get; set; }
    }
}
