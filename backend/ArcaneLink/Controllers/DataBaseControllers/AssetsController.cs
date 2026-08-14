using System.Globalization;
using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.Services.Assets.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Route("api/assets")]
    public class AssetsController : ControllerBase
    {
        private readonly IAssetService _assetService;

        public AssetsController(IAssetService assetService)
        {
            _assetService = assetService;
        }

        [Authorize]
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Uploads)]
        public async Task<ActionResult<AssetResponse>> UploadAsset(
            [FromForm] UploadAssetRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _assetService.UploadAssetAsync(
                userId.Value,
                request,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetAsset),
                new
                {
                    id = response.Id
                },
                response);
        }

        [Authorize]
        [HttpPost]
        public IActionResult CreateAsset()
        {
            // Legacy metadata-only creation trusted a provider key supplied by
            // the client. Keep a tombstone for old clients while all supported
            // creation flows go through server-managed multipart uploads.
            return StatusCode(StatusCodes.Status410Gone);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<AssetResponse>> GetAsset(
            Guid id,
            CancellationToken cancellationToken)
        {
            var response = await _assetService.GetReadableAssetAsync(
                GetCurrentUserId(),
                id,
                cancellationToken);

            if (response == null)
            {
                return NotFound();
            }

            return Ok(response);
        }

        [Authorize]
        [HttpGet("me/avatar")]
        public async Task<ActionResult<IReadOnlyList<AssetResponse>>> GetMyAvatarAssets(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _assetService.GetOwnedAssetsAsync(
                userId.Value,
                AssetTypeIds.Avatar,
                cancellationToken);

            return Ok(response);
        }

        [Authorize]
        [HttpGet("me/server-icon")]
        public async Task<ActionResult<IReadOnlyList<AssetResponse>>> GetMyServerIconAssets(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _assetService.GetOwnedAssetsAsync(
                userId.Value,
                AssetTypeIds.ServerIcon,
                cancellationToken);

            return Ok(response);
        }

        [Authorize]
        [HttpGet("me/banner")]
        public async Task<ActionResult<IReadOnlyList<AssetResponse>>> GetMyBannerAssets(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _assetService.GetOwnedAssetsAsync(
                userId.Value,
                AssetTypeIds.Banner,
                cancellationToken);

            return Ok(response);
        }

        [Authorize]
        [HttpGet("me/profile-background")]
        public async Task<ActionResult<IReadOnlyList<AssetResponse>>> GetMyProfileBackgroundAssets(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _assetService.GetOwnedAssetsAsync(
                userId.Value,
                AssetTypeIds.ProfileBackground,
                cancellationToken);

            return Ok(response);
        }

        [HttpGet("{id:guid}/content")]
        public async Task<IActionResult> GetAssetContent(
            Guid id,
            CancellationToken cancellationToken)
        {
            var response = await _assetService.GetReadableAssetContentAsync(
                GetCurrentUserId(),
                id,
                cancellationToken);

            if (response == null)
            {
                return NotFound();
            }

            var etag = $"\"{response.Sha256}\"";

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = response.IsPubliclyCacheable
                ? "public, max-age=31536000, immutable"
                : "private, no-store";
            Response.Headers["ETag"] = etag;
            Response.Headers["Last-Modified"] = response.CreatedAt
                .ToUniversalTime()
                .ToString("R", CultureInfo.InvariantCulture);
            Response.Headers["Content-Disposition"] = BuildContentDisposition(
                response.IsSafeInline,
                response.FileName);

            var ifNoneMatch = Request.Headers["If-None-Match"];
            if (response.IsPubliclyCacheable &&
                ifNoneMatch.Any(value =>
                    string.Equals(value, etag, StringComparison.Ordinal) ||
                    string.Equals(value, "*", StringComparison.Ordinal)))
            {
                await response.Content.DisposeAsync();
                return StatusCode(StatusCodes.Status304NotModified);
            }

            return File(
                response.Content,
                response.IsSafeInline ? response.MimeType : "application/octet-stream",
                enableRangeProcessing: true);
        }

        [Authorize]
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteAsset(
            Guid id,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var result = await _assetService.DeleteOwnedAssetAsync(
                userId.Value,
                id,
                cancellationToken);

            return result switch
            {
                OwnedAssetDeleteResult.Deleted => NoContent(),
                OwnedAssetDeleteResult.ManagedByDomain => Conflict(new
                {
                    code = "asset_managed_by_domain"
                }),
                _ => NotFound()
            };
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue("userId");

            return Guid.TryParse(userIdValue, out var userId)
                ? userId
                : null;
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
