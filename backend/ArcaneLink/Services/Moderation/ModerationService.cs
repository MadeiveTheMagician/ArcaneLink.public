using System.Data;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Moderation;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.ModerationModels;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Moderation.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Moderation
{
    public sealed class ModerationService : IModerationService
    {
        private const int BodyExcerptLength = 2000;
        private const int PayloadExcerptLength = 4000;
        private const int MaximumMyReports = 200;
        private readonly AppDbContext _db;
        private readonly ISpaceAuthorizationService _spaceAuthorization;
        private readonly SpaceMessageAccessService _messageAccess;
        private readonly IServerGovernanceAccessService _serverAccess;
        private readonly ServerPermissionRealtimeAudienceService _permissionAudience;
        private readonly IAssetService _assetService;
        private readonly IRealtimeNotificationService _realtime;
        private readonly TimeProvider _timeProvider;
        private readonly ILogger<ModerationService> _logger;

        public ModerationService(
            AppDbContext db,
            ISpaceAuthorizationService spaceAuthorization,
            SpaceMessageAccessService messageAccess,
            IServerGovernanceAccessService serverAccess,
            ServerPermissionRealtimeAudienceService permissionAudience,
            IAssetService assetService,
            IRealtimeNotificationService realtime,
            TimeProvider timeProvider,
            ILogger<ModerationService> logger)
        {
            this._db = db;
            this._spaceAuthorization = spaceAuthorization;
            this._messageAccess = messageAccess;
            this._serverAccess = serverAccess;
            this._permissionAudience = permissionAudience;
            this._assetService = assetService;
            this._realtime = realtime;
            this._timeProvider = timeProvider;
            this._logger = logger;
        }

        public async Task<CreateModerationReportResult> CreateMessageReportAsync(
            Guid reporterUserId,
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            CreateModerationReportRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!ModerationReasonCodes.All.Contains(request.ReasonCode))
            {
                return CreateModerationReportResult.InvalidReason();
            }

            var readableSpace = await this._messageAccess.GetReadableMessageSpaceAsync(
                reporterUserId,
                serverId,
                spaceId,
                cancellationToken);
            if (readableSpace == null)
            {
                return CreateModerationReportResult.NotFound();
            }

            var message = await this._db.SpaceMessages
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.Assets)
                    .ThenInclude(x => x.Asset)
                .FirstOrDefaultAsync(
                    x => x.Id == messageId &&
                         x.SpaceId == spaceId &&
                         x.Space.ServerId == serverId &&
                         x.Space.DeletedAt == null &&
                         x.Space.Server!.DeletedAt == null &&
                         x.DeletedAt == null &&
                         x.SenderUserId != reporterUserId &&
                         x.SenderUser.DeletedAt == null &&
                         x.SenderUser.StatusId == UserStatusIds.Active,
                    cancellationToken);
            if (message == null)
            {
                return CreateModerationReportResult.NotFound();
            }

            var eligibleMemberCount = await this._db.ServerMembers
                .AsNoTracking()
                .Where(x =>
                    x.ServerId == serverId &&
                    (x.UserId == reporterUserId ||
                     x.UserId == message.SenderUserId) &&
                    x.StatusId == ServerMemberStatusIds.Active &&
                    x.BannedAt == null &&
                    x.User.DeletedAt == null &&
                    x.User.StatusId == UserStatusIds.Active)
                .Select(x => x.UserId)
                .Distinct()
                .CountAsync(cancellationToken);
            if (eligibleMemberCount != 2)
            {
                return CreateModerationReportResult.NotFound();
            }

            for (var attempt = 0; attempt < 2; attempt++)
            {
                try
                {
                    var result = await this.CreateReportTransactionAsync(
                        reporterUserId,
                        serverId,
                        spaceId,
                        message,
                        request,
                        cancellationToken);

                    if (result.IsNewSubmission)
                    {
                        await this.NotifyReportCommittedAsync(
                            reporterUserId,
                            result.CaseId,
                            serverId,
                            messageId,
                            result.Report.UpdatedAt);
                    }

                    return CreateModerationReportResult.Success(result.Report);
                }
                catch (DbUpdateException)
                {
                    // The unique case/message and case/reporter constraints are
                    // the final guard for concurrent submissions. Reload once
                    // and turn the losing request into the same idempotent 200.
                    this._db.ChangeTracker.Clear();
                    if (attempt == 1)
                    {
                        break;
                    }
                }
            }

            var concurrentDuplicate = await this.LoadExistingReportAsync(
                reporterUserId,
                messageId,
                cancellationToken);
            if (concurrentDuplicate != null)
            {
                return CreateModerationReportResult.Success(concurrentDuplicate);
            }

            throw new InvalidOperationException(
                "A moderation report could not be persisted after retrying a concurrent write.");
        }

        public async Task<IReadOnlyList<ModerationReportResponse>> GetMyReportsAsync(
            Guid reporterUserId,
            CancellationToken cancellationToken = default)
        {
            var isActive = await this._db.Users.AsNoTracking().AnyAsync(
                x => x.Id == reporterUserId &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active,
                cancellationToken);
            if (!isActive)
            {
                return [];
            }

            var submissions = await this._db.ModerationSubmissions
                .AsNoTracking()
                .Include(x => x.Case)
                .Where(x => x.ReporterUserId == reporterUserId)
                .OrderByDescending(x => x.SubmittedAt)
                .ThenByDescending(x => x.Id)
                .Take(MaximumMyReports)
                .ToListAsync(cancellationToken);

            return submissions.Select(ToReporterResponse).ToList();
        }

        public async Task<ModerationCasePageResponse?> GetCasesAsync(
            Guid reviewerUserId,
            Guid serverId,
            string? status,
            DateTime? beforeUpdatedAt,
            Guid? beforeId,
            int limit,
            CancellationToken cancellationToken = default)
        {
            var visibleSpaceIds = await this.GetReviewableSpaceIdsAsync(
                reviewerUserId,
                serverId,
                cancellationToken);
            if (visibleSpaceIds == null)
            {
                return null;
            }

            var query = this._db.ModerationCases
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.ReportedUser)
                    .ThenInclude(x => x.Profile)
                .Include(x => x.Submissions)
                .Where(x =>
                    x.ServerId == serverId &&
                    visibleSpaceIds.Contains(x.SpaceId) &&
                    x.ReportedUserId != reviewerUserId &&
                    !x.Submissions.Any(submission =>
                        submission.ReporterUserId == reviewerUserId));

            if (status != null)
            {
                query = query.Where(x => x.Status == status);
            }

            if (beforeUpdatedAt != null && beforeId != null)
            {
                var cursorTime = NormalizeUtc(beforeUpdatedAt.Value);
                var cursorId = beforeId.Value;
                query = query.Where(x =>
                    x.UpdatedAt < cursorTime ||
                    (x.UpdatedAt == cursorTime &&
                     x.Id.CompareTo(cursorId) < 0));
            }

            var pageSize = Math.Clamp(limit, 1, 100);
            var cases = await query
                .OrderByDescending(x => x.UpdatedAt)
                .ThenByDescending(x => x.Id)
                .Take(pageSize + 1)
                .ToListAsync(cancellationToken);
            var hasMore = cases.Count > pageSize;
            if (hasMore)
            {
                cases.RemoveAt(cases.Count - 1);
            }

            return new ModerationCasePageResponse
            {
                Items = cases.Select(ToSummaryResponse).ToList(),
                NextCursor = hasMore && cases.Count > 0
                    ? new ModerationCaseCursorResponse
                    {
                        UpdatedAt = cases[^1].UpdatedAt,
                        Id = cases[^1].Id
                    }
                    : null
            };
        }

        public async Task<ModerationCaseDetailResponse?> GetCaseAsync(
            Guid reviewerUserId,
            Guid serverId,
            Guid caseId,
            CancellationToken cancellationToken = default)
        {
            var visibleSpaceIds = await this.GetReviewableSpaceIdsAsync(
                reviewerUserId,
                serverId,
                cancellationToken);
            if (visibleSpaceIds == null)
            {
                return null;
            }

            var moderationCase = await this.LoadCaseForReviewerAsync(
                reviewerUserId,
                serverId,
                caseId,
                visibleSpaceIds,
                tracked: false,
                cancellationToken);

            return moderationCase == null
                ? null
                : ToDetailResponse(moderationCase);
        }

        public async Task<UpdateModerationCaseResult> UpdateCaseAsync(
            Guid reviewerUserId,
            Guid serverId,
            Guid caseId,
            UpdateModerationCaseRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!ModerationCaseStatuses.All.Contains(request.Status) ||
                request.ExpectedUpdatedAt == default)
            {
                return UpdateModerationCaseResult.InvalidStatus();
            }

            var visibleSpaceIds = await this.GetReviewableSpaceIdsAsync(
                reviewerUserId,
                serverId,
                cancellationToken);
            if (visibleSpaceIds == null)
            {
                return UpdateModerationCaseResult.NotFound();
            }

            var moderationCase = await this.LoadCaseForReviewerAsync(
                reviewerUserId,
                serverId,
                caseId,
                visibleSpaceIds,
                tracked: true,
                cancellationToken);
            if (moderationCase == null)
            {
                return UpdateModerationCaseResult.NotFound();
            }

            if (moderationCase.UpdatedAt.Ticks !=
                NormalizeUtc(request.ExpectedUpdatedAt).Ticks)
            {
                return UpdateModerationCaseResult.Conflict();
            }

            if (string.Equals(
                    moderationCase.Status,
                    request.Status,
                    StringComparison.Ordinal))
            {
                return UpdateModerationCaseResult.InvalidStatus();
            }

            var previousStatus = moderationCase.Status;
            var now = this.NextTimestamp(moderationCase.UpdatedAt);
            moderationCase.Status = request.Status;
            moderationCase.UpdatedAt = now;
            moderationCase.Actions.Add(new ModerationCaseAction
            {
                Id = Guid.NewGuid(),
                CaseId = moderationCase.Id,
                ActorUserId = reviewerUserId,
                FromStatus = previousStatus,
                ToStatus = request.Status,
                Note = NormalizeOptionalText(request.Note),
                CreatedAt = now
            });

            try
            {
                await this._db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return UpdateModerationCaseResult.Conflict();
            }

            await this.NotifyCaseUpdatedAsync(
                moderationCase.Id,
                serverId,
                moderationCase.MessageId,
                moderationCase.UpdatedAt);

            return UpdateModerationCaseResult.Success(
                ToDetailResponse(moderationCase));
        }

        public async Task<AssetContentResponse?> GetEvidenceAssetContentAsync(
            Guid reviewerUserId,
            Guid serverId,
            Guid caseId,
            Guid evidenceAssetId,
            CancellationToken cancellationToken = default)
        {
            var visibleSpaceIds = await this.GetReviewableSpaceIdsAsync(
                reviewerUserId,
                serverId,
                cancellationToken);
            if (visibleSpaceIds == null)
            {
                return null;
            }

            var assetId = await this._db.ModerationEvidenceAssets
                .AsNoTracking()
                .Where(x =>
                    x.Id == evidenceAssetId &&
                    x.Evidence.Submission.CaseId == caseId &&
                    x.Evidence.Submission.Case.ServerId == serverId &&
                    visibleSpaceIds.Contains(
                        x.Evidence.Submission.Case.SpaceId) &&
                    x.Evidence.Submission.Case.ReportedUserId != reviewerUserId &&
                    !x.Evidence.Submission.Case.Submissions.Any(submission =>
                        submission.ReporterUserId == reviewerUserId))
                .Select(x => (Guid?)x.AssetId)
                .FirstOrDefaultAsync(cancellationToken);
            if (assetId == null)
            {
                return null;
            }

            return await this._assetService.GetRetainedAssetContentAsync(
                assetId.Value,
                cancellationToken);
        }

        private async Task<CreatedReport> CreateReportTransactionAsync(
            Guid reporterUserId,
            Guid serverId,
            Guid spaceId,
            SpaceMessage message,
            CreateModerationReportRequest request,
            CancellationToken cancellationToken)
        {
            await using var transaction = await this._db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken);

            var moderationCase = await this._db.ModerationCases
                .FirstOrDefaultAsync(
                    x => x.MessageId == message.Id,
                    cancellationToken);
            if (moderationCase != null)
            {
                var existing = await this._db.ModerationSubmissions
                    .AsNoTracking()
                    .Include(x => x.Case)
                    .FirstOrDefaultAsync(
                        x => x.CaseId == moderationCase.Id &&
                             x.ReporterUserId == reporterUserId,
                        cancellationToken);
                if (existing != null)
                {
                    await transaction.CommitAsync(cancellationToken);
                    return new CreatedReport(
                        ToReporterResponse(existing),
                        moderationCase.Id,
                        IsNewSubmission: false);
                }
            }

            var now = this._timeProvider.GetUtcNow().UtcDateTime;
            if (moderationCase == null)
            {
                moderationCase = new ModerationCase
                {
                    Id = Guid.NewGuid(),
                    ServerId = serverId,
                    SpaceId = spaceId,
                    MessageId = message.Id,
                    ReportedUserId = message.SenderUserId,
                    Status = ModerationCaseStatuses.Open,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                this._db.ModerationCases.Add(moderationCase);
            }
            else
            {
                now = this.NextTimestamp(moderationCase.UpdatedAt);
                if (moderationCase.Status is
                    ModerationCaseStatuses.Resolved or
                    ModerationCaseStatuses.Dismissed)
                {
                    var previousStatus = moderationCase.Status;
                    moderationCase.Status = ModerationCaseStatuses.Open;
                    moderationCase.Actions.Add(new ModerationCaseAction
                    {
                        Id = Guid.NewGuid(),
                        CaseId = moderationCase.Id,
                        ActorUserId = null,
                        FromStatus = previousStatus,
                        ToStatus = ModerationCaseStatuses.Open,
                        Note = "Reopened by a new report.",
                        CreatedAt = now
                    });
                }

                moderationCase.UpdatedAt = now;
            }

            var submission = new ModerationSubmission
            {
                Id = Guid.NewGuid(),
                CaseId = moderationCase.Id,
                ReporterUserId = reporterUserId,
                ReasonCode = request.ReasonCode,
                Details = NormalizeOptionalText(request.Details),
                SubmittedAt = now
            };
            var evidence = new ModerationEvidence
            {
                Id = Guid.NewGuid(),
                SubmissionId = submission.Id,
                BodyExcerpt = Truncate(message.Body, BodyExcerptLength),
                PayloadExcerpt = Truncate(message.Payload, PayloadExcerptLength),
                CanonicalContentSha256 = ModerationEvidenceHasher.Compute(
                    message,
                    message.Assets),
                MessageCreatedAt = message.CreatedAt,
                MessageUpdatedAt = message.UpdatedAt,
                MessageEditedAt = message.EditedAt,
                CapturedAt = now
            };

            foreach (var attachment in message.Assets
                         .OrderBy(x => x.DisplayOrder)
                         .ThenBy(x => x.AssetId))
            {
                evidence.Assets.Add(new ModerationEvidenceAsset
                {
                    Id = Guid.NewGuid(),
                    EvidenceId = evidence.Id,
                    AssetId = attachment.AssetId,
                    DisplayOrder = attachment.DisplayOrder,
                    DisplayName = attachment.DisplayName,
                    IsSpoiler = attachment.IsSpoiler,
                    OriginalFileName = attachment.Asset.OriginalFileName,
                    MimeType = attachment.Asset.MimeType,
                    SizeBytes = attachment.Asset.SizeBytes,
                    Sha256 = attachment.Asset.Sha256,
                    Width = attachment.Asset.Width,
                    Height = attachment.Asset.Height,
                    AssetCreatedAt = attachment.Asset.CreatedAt
                });
            }

            submission.Evidence = evidence;
            moderationCase.Submissions.Add(submission);
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new CreatedReport(
                ToReporterResponse(submission),
                moderationCase.Id,
                IsNewSubmission: true);
        }

        private async Task<ModerationReportResponse?> LoadExistingReportAsync(
            Guid reporterUserId,
            Guid messageId,
            CancellationToken cancellationToken)
        {
            var submission = await this._db.ModerationSubmissions
                .AsNoTracking()
                .Include(x => x.Case)
                .FirstOrDefaultAsync(
                    x => x.ReporterUserId == reporterUserId &&
                         x.Case.MessageId == messageId,
                    cancellationToken);

            return submission == null ? null : ToReporterResponse(submission);
        }

        private async Task<ModerationCase?> LoadCaseForReviewerAsync(
            Guid reviewerUserId,
            Guid serverId,
            Guid caseId,
            IReadOnlyList<Guid> visibleSpaceIds,
            bool tracked,
            CancellationToken cancellationToken)
        {
            IQueryable<ModerationCase> query = this._db.ModerationCases;
            if (!tracked)
            {
                query = query.AsNoTracking();
            }

            return await query
                .AsSplitQuery()
                .Include(x => x.ReportedUser)
                    .ThenInclude(x => x.Profile)
                .Include(x => x.Submissions)
                    .ThenInclude(x => x.Evidence)
                    .ThenInclude(x => x.Assets)
                .Include(x => x.Actions)
                .FirstOrDefaultAsync(
                    x => x.Id == caseId &&
                         x.ServerId == serverId &&
                         visibleSpaceIds.Contains(x.SpaceId) &&
                         x.ReportedUserId != reviewerUserId &&
                         !x.Submissions.Any(submission =>
                             submission.ReporterUserId == reviewerUserId),
                    cancellationToken);
        }

        private Task<bool> CanReviewAsync(
            Guid reviewerUserId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            return this._serverAccess.HasGranularPermissionAsync(
                reviewerUserId,
                serverId,
                "MANAGE_REPORTS",
                cancellationToken);
        }

        private async Task<IReadOnlyList<Guid>?> GetReviewableSpaceIdsAsync(
            Guid reviewerUserId,
            Guid serverId,
            CancellationToken cancellationToken)
        {
            if (!await this.CanReviewAsync(
                    reviewerUserId,
                    serverId,
                    cancellationToken))
            {
                return null;
            }

            var visibleSpaceIds = await this._spaceAuthorization.GetAllowedSpaceIdsAsync(
                reviewerUserId,
                serverId,
                SpaceAction.View,
                cancellationToken);
            if (visibleSpaceIds == null)
            {
                return null;
            }

            var readableSpaceIds = new List<Guid>(visibleSpaceIds.Count);
            foreach (var spaceId in visibleSpaceIds)
            {
                if (await this._messageAccess.GetReadableMessageSpaceAsync(
                        reviewerUserId,
                        serverId,
                        spaceId,
                        cancellationToken) != null)
                {
                    readableSpaceIds.Add(spaceId);
                }
            }

            return readableSpaceIds;
        }

        private async Task NotifyReportCommittedAsync(
            Guid reporterUserId,
            Guid caseId,
            Guid serverId,
            Guid messageId,
            DateTime updatedAt)
        {
            await this.TryNotifyAsync(async () =>
            {
                await this._realtime.NotifyUserAsync(
                    reporterUserId,
                    RealtimeEventNames.MyModerationReportsChanged,
                    new { serverId, messageId, updatedAt },
                    CancellationToken.None);
            }, caseId, "reporter");

            await this.NotifyReviewersAsync(caseId, serverId, updatedAt);
        }

        private async Task NotifyCaseUpdatedAsync(
            Guid caseId,
            Guid serverId,
            Guid messageId,
            DateTime updatedAt)
        {
            await this.TryNotifyAsync(async () =>
            {
                var reporterIds = await this._db.ModerationSubmissions
                    .AsNoTracking()
                    .Where(x => x.CaseId == caseId)
                    .Select(x => x.ReporterUserId)
                    .Distinct()
                    .ToListAsync(CancellationToken.None);

                await this._realtime.NotifyUsersAsync(
                    reporterIds,
                    RealtimeEventNames.MyModerationReportsChanged,
                    new { serverId, messageId, updatedAt },
                    CancellationToken.None);
            }, caseId, "reporters");

            await this.NotifyReviewersAsync(caseId, serverId, updatedAt);
        }

        private async Task NotifyReviewersAsync(
            Guid caseId,
            Guid serverId,
            DateTime updatedAt)
        {
            await this.TryNotifyAsync(async () =>
            {
                var excludedUserIds = await this._db.ModerationSubmissions
                    .AsNoTracking()
                    .Where(x => x.CaseId == caseId)
                    .Select(x => x.ReporterUserId)
                    .ToListAsync(CancellationToken.None);
                var caseAudience = await this._db.ModerationCases
                    .AsNoTracking()
                    .Where(x => x.Id == caseId)
                    .Select(x => new { x.ReportedUserId, x.SpaceId })
                    .SingleAsync(CancellationToken.None);
                excludedUserIds.Add(caseAudience.ReportedUserId);

                var candidateReviewerIds = await this._permissionAudience.ResolveAsync(
                    serverId,
                    ["MANAGE_REPORTS"],
                    excludedUserIds: excludedUserIds,
                    cancellationToken: CancellationToken.None);
                var reviewerIds = new List<Guid>(candidateReviewerIds.Count);
                foreach (var reviewerId in candidateReviewerIds)
                {
                    if (await this._messageAccess.GetReadableMessageSpaceAsync(
                            reviewerId,
                            serverId,
                            caseAudience.SpaceId,
                            CancellationToken.None) != null)
                    {
                        reviewerIds.Add(reviewerId);
                    }
                }

                await this._realtime.NotifyUsersAsync(
                    reviewerIds,
                    RealtimeEventNames.ModerationCaseChanged,
                    new { serverId, caseId, updatedAt },
                    CancellationToken.None);
            }, caseId, "reviewers");
        }

        private async Task TryNotifyAsync(
            Func<Task> notify,
            Guid caseId,
            string audience)
        {
            try
            {
                await notify();
            }
            catch (Exception exception)
            {
                this._logger.LogWarning(
                    exception,
                    "Moderation realtime delivery failed after commit. CaseId={CaseId} Audience={Audience}",
                    caseId,
                    audience);
            }
        }

        private DateTime NextTimestamp(DateTime current)
        {
            var now = this._timeProvider.GetUtcNow().UtcDateTime;
            return now > current ? now : current.AddTicks(10);
        }

        private static ModerationReportResponse ToReporterResponse(
            ModerationSubmission submission)
        {
            return new ModerationReportResponse
            {
                ReportId = submission.Id,
                ServerId = submission.Case.ServerId,
                SpaceId = submission.Case.SpaceId,
                MessageId = submission.Case.MessageId,
                ReasonCode = submission.ReasonCode,
                Details = submission.Details,
                Status = ToReporterStatus(submission.Case.Status),
                SubmittedAt = submission.SubmittedAt,
                UpdatedAt = submission.Case.UpdatedAt
            };
        }

        private static ModerationCaseSummaryResponse ToSummaryResponse(
            ModerationCase moderationCase)
        {
            return new ModerationCaseSummaryResponse
            {
                CaseId = moderationCase.Id,
                ServerId = moderationCase.ServerId,
                SpaceId = moderationCase.SpaceId,
                MessageId = moderationCase.MessageId,
                ReportedUserId = moderationCase.ReportedUserId,
                ReportedUserDisplayName = moderationCase.ReportedUser.Profile.DisplayName,
                Status = moderationCase.Status,
                SubmissionCount = moderationCase.Submissions.Count,
                ReasonCodes = moderationCase.Submissions
                    .Select(x => x.ReasonCode)
                    .Distinct(StringComparer.Ordinal)
                    .Order(StringComparer.Ordinal)
                    .ToList(),
                CreatedAt = moderationCase.CreatedAt,
                UpdatedAt = moderationCase.UpdatedAt
            };
        }

        private static ModerationCaseDetailResponse ToDetailResponse(
            ModerationCase moderationCase)
        {
            return new ModerationCaseDetailResponse
            {
                CaseId = moderationCase.Id,
                ServerId = moderationCase.ServerId,
                SpaceId = moderationCase.SpaceId,
                MessageId = moderationCase.MessageId,
                ReportedUserId = moderationCase.ReportedUserId,
                ReportedUserDisplayName = moderationCase.ReportedUser.Profile.DisplayName,
                Status = moderationCase.Status,
                CreatedAt = moderationCase.CreatedAt,
                UpdatedAt = moderationCase.UpdatedAt,
                Evidence = moderationCase.Submissions
                    .OrderBy(x => x.SubmittedAt)
                    .ThenBy(x => x.Id)
                    .Select(submission => new ModerationEvidenceResponse
                    {
                        EvidenceId = submission.Evidence.Id,
                        ReasonCode = submission.ReasonCode,
                        Details = submission.Details,
                        SubmittedAt = submission.SubmittedAt,
                        BodyExcerpt = submission.Evidence.BodyExcerpt,
                        PayloadExcerpt = submission.Evidence.PayloadExcerpt,
                        ContentSha256 = submission.Evidence.CanonicalContentSha256,
                        MessageCreatedAt = submission.Evidence.MessageCreatedAt,
                        MessageUpdatedAt = submission.Evidence.MessageUpdatedAt,
                        MessageEditedAt = submission.Evidence.MessageEditedAt,
                        CapturedAt = submission.Evidence.CapturedAt,
                        Assets = submission.Evidence.Assets
                            .OrderBy(x => x.DisplayOrder)
                            .ThenBy(x => x.Id)
                            .Select(asset => new ModerationEvidenceAssetResponse
                            {
                                EvidenceAssetId = asset.Id,
                                DisplayOrder = asset.DisplayOrder,
                                FileName = asset.DisplayName ??
                                           asset.OriginalFileName ??
                                           "attachment",
                                MimeType = asset.MimeType,
                                SizeBytes = asset.SizeBytes,
                                Sha256 = asset.Sha256,
                                Width = asset.Width,
                                Height = asset.Height,
                                IsSpoiler = asset.IsSpoiler,
                                CreatedAt = asset.AssetCreatedAt,
                                ContentUrl =
                                    $"/api/servers/{moderationCase.ServerId}/moderation/cases/{moderationCase.Id}/evidence-assets/{asset.Id}/content"
                            })
                            .ToList()
                    })
                    .ToList(),
                Actions = moderationCase.Actions
                    .OrderBy(x => x.CreatedAt)
                    .ThenBy(x => x.Id)
                    .Select(action => new ModerationCaseActionResponse
                    {
                        ActionId = action.Id,
                        FromStatus = action.FromStatus,
                        ToStatus = action.ToStatus,
                        Note = action.Note,
                        CreatedAt = action.CreatedAt
                    })
                    .ToList()
            };
        }

        private static string ToReporterStatus(string status)
        {
            return status switch
            {
                ModerationCaseStatuses.Open => "received",
                ModerationCaseStatuses.InReview => "under_review",
                ModerationCaseStatuses.Resolved or
                    ModerationCaseStatuses.Dismissed => "closed",
                _ => "closed"
            };
        }

        private static string? NormalizeOptionalText(string? value)
        {
            var normalized = value?.Trim();
            return string.IsNullOrEmpty(normalized) ? null : normalized;
        }

        private static string? Truncate(string? value, int length)
        {
            return value == null || value.Length <= length
                ? value
                : value[..length];
        }

        private static DateTime NormalizeUtc(DateTime value)
        {
            return value.Kind switch
            {
                DateTimeKind.Utc => value,
                DateTimeKind.Local => value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
            };
        }

        private sealed record CreatedReport(
            ModerationReportResponse Report,
            Guid CaseId,
            bool IsNewSubmission);
    }
}
