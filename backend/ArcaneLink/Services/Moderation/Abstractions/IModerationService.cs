using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Moderation;

namespace ArcaneLink.Services.Moderation.Abstractions;

public interface IModerationService
{
    Task<CreateModerationReportResult> CreateMessageReportAsync(
        Guid reporterUserId,
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CreateModerationReportRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ModerationReportResponse>> GetMyReportsAsync(
        Guid reporterUserId,
        CancellationToken cancellationToken = default);

    Task<ModerationCasePageResponse?> GetCasesAsync(
        Guid reviewerUserId,
        Guid serverId,
        string? status,
        DateTime? beforeUpdatedAt,
        Guid? beforeId,
        int limit,
        CancellationToken cancellationToken = default);

    Task<ModerationCaseDetailResponse?> GetCaseAsync(
        Guid reviewerUserId,
        Guid serverId,
        Guid caseId,
        CancellationToken cancellationToken = default);

    Task<UpdateModerationCaseResult> UpdateCaseAsync(
        Guid reviewerUserId,
        Guid serverId,
        Guid caseId,
        UpdateModerationCaseRequest request,
        CancellationToken cancellationToken = default);

    Task<AssetContentResponse?> GetEvidenceAssetContentAsync(
        Guid reviewerUserId,
        Guid serverId,
        Guid caseId,
        Guid evidenceAssetId,
        CancellationToken cancellationToken = default);
}

public enum CreateModerationReportStatus
{
    Success,
    InvalidReason,
    NotFound
}

public sealed record CreateModerationReportResult(
    CreateModerationReportStatus Status,
    ModerationReportResponse? Report = null)
{
    public static CreateModerationReportResult Success(
        ModerationReportResponse report) =>
        new(CreateModerationReportStatus.Success, report);

    public static CreateModerationReportResult InvalidReason() =>
        new(CreateModerationReportStatus.InvalidReason);

    public static CreateModerationReportResult NotFound() =>
        new(CreateModerationReportStatus.NotFound);
}

public enum UpdateModerationCaseStatus
{
    Success,
    InvalidStatus,
    NotFound,
    Conflict
}

public sealed record UpdateModerationCaseResult(
    UpdateModerationCaseStatus Status,
    ModerationCaseDetailResponse? Case = null)
{
    public static UpdateModerationCaseResult Success(
        ModerationCaseDetailResponse response) =>
        new(UpdateModerationCaseStatus.Success, response);

    public static UpdateModerationCaseResult InvalidStatus() =>
        new(UpdateModerationCaseStatus.InvalidStatus);

    public static UpdateModerationCaseResult NotFound() =>
        new(UpdateModerationCaseStatus.NotFound);

    public static UpdateModerationCaseResult Conflict() =>
        new(UpdateModerationCaseStatus.Conflict);
}
