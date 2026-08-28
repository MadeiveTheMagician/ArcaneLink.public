using System.Globalization;
using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Moderation;
using ArcaneLink.Services.Moderation.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    public sealed class ModerationController : ControllerBase
    {
        private readonly IModerationService _moderation;

        public ModerationController(IModerationService moderation)
        {
            this._moderation = moderation;
        }

        [HttpPost("api/servers/{serverId:guid}/spaces/{spaceId:guid}/messages/{messageId:guid}/reports")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.ModerationReports)]
        public async Task<ActionResult<ModerationReportResponse>> CreateMessageReport(
            Guid serverId,
            Guid spaceId,
            Guid messageId,
            [FromBody] CreateModerationReportRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var result = await this._moderation.CreateMessageReportAsync(
                userId.Value,
                serverId,
                spaceId,
                messageId,
                request,
                cancellationToken);

            return result.Status switch
            {
                CreateModerationReportStatus.Success => this.Ok(result.Report),
                CreateModerationReportStatus.InvalidReason => this.BadRequest(
                    new { code = "invalid_moderation_reason" }),
                _ => this.NotFound()
            };
        }

        [HttpGet("api/users/me/moderation-reports")]
        public async Task<ActionResult<IReadOnlyList<ModerationReportResponse>>> GetMyReports(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._moderation.GetMyReportsAsync(
                userId.Value,
                cancellationToken));
        }

        [HttpGet("api/servers/{serverId:guid}/moderation/cases")]
        public async Task<ActionResult<ModerationCasePageResponse>> GetCases(
            Guid serverId,
            [FromQuery] string? status = null,
            [FromQuery] DateTime? beforeUpdatedAt = null,
            [FromQuery] Guid? beforeId = null,
            [FromQuery] int limit = 50,
            CancellationToken cancellationToken = default)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            if ((status != null && !ModerationCaseStatuses.All.Contains(status)) ||
                (beforeUpdatedAt == null) != (beforeId == null) ||
                limit is < 1 or > 100)
            {
                return this.BadRequest(new { code = "invalid_moderation_case_query" });
            }

            var response = await this._moderation.GetCasesAsync(
                userId.Value,
                serverId,
                status,
                beforeUpdatedAt,
                beforeId,
                limit,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpGet("api/servers/{serverId:guid}/moderation/cases/{caseId:guid}")]
        public async Task<ActionResult<ModerationCaseDetailResponse>> GetCase(
            Guid serverId,
            Guid caseId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._moderation.GetCaseAsync(
                userId.Value,
                serverId,
                caseId,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpPatch("api/servers/{serverId:guid}/moderation/cases/{caseId:guid}")]
        public async Task<ActionResult<ModerationCaseDetailResponse>> UpdateCase(
            Guid serverId,
            Guid caseId,
            [FromBody] UpdateModerationCaseRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var result = await this._moderation.UpdateCaseAsync(
                userId.Value,
                serverId,
                caseId,
                request,
                cancellationToken);

            return result.Status switch
            {
                UpdateModerationCaseStatus.Success => this.Ok(result.Case),
                UpdateModerationCaseStatus.InvalidStatus => this.BadRequest(
                    new { code = "invalid_moderation_case_update" }),
                UpdateModerationCaseStatus.Conflict => this.Conflict(
                    new { code = "moderation_case_conflict" }),
                _ => this.NotFound()
            };
        }

        [HttpGet("api/servers/{serverId:guid}/moderation/cases/{caseId:guid}/evidence-assets/{evidenceAssetId:guid}/content")]
        public async Task<IActionResult> GetEvidenceAssetContent(
            Guid serverId,
            Guid caseId,
            Guid evidenceAssetId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._moderation.GetEvidenceAssetContentAsync(
                userId.Value,
                serverId,
                caseId,
                evidenceAssetId,
                cancellationToken);
            if (response == null)
            {
                return this.NotFound();
            }

            this.Response.Headers["X-Content-Type-Options"] = "nosniff";
            this.Response.Headers["Cache-Control"] = "private, no-store";
            this.Response.Headers["ETag"] = $"\"{response.Sha256}\"";
            this.Response.Headers["Last-Modified"] = response.CreatedAt
                .ToUniversalTime()
                .ToString("R", CultureInfo.InvariantCulture);
            this.Response.Headers["Content-Disposition"] = BuildContentDisposition(
                response.IsSafeInline,
                response.FileName);

            return this.File(
                response.Content,
                response.IsSafeInline
                    ? response.MimeType
                    : "application/octet-stream",
                enableRangeProcessing: true);
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = this.User.FindFirstValue("userId");
            return Guid.TryParse(userIdValue, out var userId) ? userId : null;
        }

        private static string BuildContentDisposition(bool isInline, string fileName)
        {
            var normalized = Path.GetFileName(fileName);
            var asciiFallback = new string(normalized
                .Select(character =>
                    character is >= (char)0x20 and <= (char)0x7E &&
                    character is not '\\' and not '"'
                        ? character
                        : '_')
                .ToArray());
            var encodedFileName = Uri.EscapeDataString(normalized);
            var disposition = isInline ? "inline" : "attachment";

            return $"{disposition}; filename=\"{asciiFallback}\"; filename*=UTF-8''{encodedFileName}";
        }
    }
}
