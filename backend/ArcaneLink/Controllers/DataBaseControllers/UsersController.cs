using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Route("api/users")]
    public class UsersController : ControllerBase
    {
        private readonly IUserProfileService _userProfileService;
        private readonly IUserDiscoveryService _userDiscoveryService;
        private readonly IUserProfileSettingsService _userProfileSettingsService;
        private readonly IUserProfileTagService _userProfileTagService;
        private readonly IUserProfileAssetService _userProfileAssetService;
        private readonly IDirectMessagePrivacyService _directMessagePrivacy;

        public UsersController(
            IUserProfileService userProfileService,
            IUserDiscoveryService userDiscoveryService,
            IUserProfileSettingsService userProfileSettingsService,
            IUserProfileTagService userProfileTagService,
            IUserProfileAssetService userProfileAssetService,
            IDirectMessagePrivacyService directMessagePrivacy)
        {
            this._userProfileService = userProfileService;
            this._userDiscoveryService = userDiscoveryService;
            this._userProfileSettingsService = userProfileSettingsService;
            this._userProfileTagService = userProfileTagService;
            this._userProfileAssetService = userProfileAssetService;
            this._directMessagePrivacy = directMessagePrivacy;
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserResponse>> GetMe(CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileService.GetCurrentUserAsync(
                userId.Value,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [HttpGet("{id:guid}")]
        public async Task<ActionResult<PublicUserProfileResponse>> GetById(
            Guid id,
            CancellationToken cancellationToken)
        {
            var response = await this._userProfileService.GetPublicProfileAsync(
                id,
                this.GetCurrentUserId(),
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpGet("me/profile")]
        public async Task<ActionResult<OwnUserProfileResponse>> GetMyProfile(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileService.GetOwnProfileAsync(
                userId.Value,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [Authorize]
        [HttpGet("profile-tags")]
        public async Task<ActionResult<IReadOnlyList<ProfileTagResponse>>> GetProfileTags(
            CancellationToken cancellationToken)
        {
            return this.Ok(await this._userProfileTagService.GetProfileTagsAsync(cancellationToken));
        }

        [Authorize]
        [HttpGet("me/profile/tags")]
        public async Task<ActionResult<IReadOnlyList<ProfileTagResponse>>> GetMyProfileTags(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._userProfileTagService.GetUserProfileTagsAsync(
                userId.Value,
                cancellationToken));
        }

        [Authorize]
        [HttpPut("me/profile/tags")]
        public async Task<ActionResult<IReadOnlyList<ProfileTagResponse>>> UpdateMyProfileTags(
            [FromBody] UpdateUserProfileTagsRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileTagService.UpdateUserProfileTagsAsync(
                userId.Value,
                request,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [Authorize]
        [HttpGet("search")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.DiscoverySearch)]
        public async Task<ActionResult<IReadOnlyList<FriendUserResponse>>> SearchUsers(
            [FromQuery] string query,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._userDiscoveryService.SearchUsersAsync(
                userId.Value,
                query,
                cancellationToken));
        }

        [Authorize]
        [HttpGet("discover")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.DiscoverySearch)]
        public async Task<ActionResult<IReadOnlyList<FriendUserResponse>>> DiscoverUsers(
            [FromQuery] UserDiscoveryQuery query,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._userDiscoveryService.DiscoverUsersAsync(
                userId.Value,
                query,
                cancellationToken));
        }

        [Authorize]
        [HttpPatch("me/profile")]
        public async Task<ActionResult<OwnUserProfileResponse>> UpdateMyProfile(
            [FromBody] UpdateUserProfileRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileService.UpdateProfileAsync(
                userId.Value,
                request,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpGet("me/profile/settings")]
        public async Task<ActionResult<UserProfileSettingsResponse>> GetMyProfileSettings(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileSettingsService.GetProfileSettingsAsync(
                userId.Value,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpPatch("me/profile/settings")]
        public async Task<ActionResult<UserProfileSettingsResponse>> UpdateMyProfileSettings(
            [FromBody] UpdateUserProfileSettingsRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileSettingsService.UpdateProfileSettingsAsync(
                userId.Value,
                request,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpGet("me/direct-message-blocks")]
        public async Task<ActionResult<DirectMessageBlockedUsersPageResponse>>
            GetMyDirectMessageBlocks(
                [FromQuery] int limit = 100,
                [FromQuery] string? cursor = null,
                CancellationToken cancellationToken = default)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._directMessagePrivacy.GetBlockedUsersAsync(
                userId.Value,
                limit,
                cursor,
                cancellationToken);
            return response == null
                ? this.BadRequest(new { code = "invalid_cursor" })
                : this.Ok(response);
        }

        [Authorize]
        [HttpGet("me/direct-message-blocks/{blockedUserId:guid}")]
        public async Task<ActionResult<DirectMessageBlockStatusResponse>>
            GetDirectMessageBlockStatus(
                Guid blockedUserId,
                CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._directMessagePrivacy.GetBlockStatusAsync(
                userId.Value,
                blockedUserId,
                cancellationToken));
        }

        [Authorize]
        [HttpPut("me/direct-message-blocks/{blockedUserId:guid}")]
        public async Task<ActionResult<DirectMessageBlockedUserResponse>>
            BlockDirectMessages(
                Guid blockedUserId,
                [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)]
                UpdateDirectMessageBlockRequest? request,
                CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._directMessagePrivacy.BlockAsync(
                userId.Value,
                blockedUserId,
                request?.Comment,
                updateComment: request != null,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [Authorize]
        [HttpDelete("me/direct-message-blocks/{blockedUserId:guid}")]
        public async Task<IActionResult> UnblockDirectMessages(
            Guid blockedUserId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            return await this._directMessagePrivacy.UnblockAsync(
                userId.Value,
                blockedUserId,
                cancellationToken)
                ? this.NoContent()
                : this.NotFound();
        }

        [Authorize]
        [HttpPost("me/profile/avatar/upload")]
        [Consumes("multipart/form-data")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Uploads)]
        public async Task<ActionResult<OwnUserProfileResponse>> UploadMyAvatar(
            [FromForm] UploadProfileAssetRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileAssetService.UploadAvatarAsync(
                userId.Value,
                request,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpPost("me/profile/avatar/{assetId:guid}")]
        public async Task<ActionResult<OwnUserProfileResponse>> SetMyAvatar(
            Guid assetId,
            [FromBody] SetAvatarRequest? request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileAssetService.SetAvatarAsync(
                userId.Value,
                assetId,
                request ?? new SetAvatarRequest(),
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpPost("me/profile/banner/upload")]
        [Consumes("multipart/form-data")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Uploads)]
        public async Task<ActionResult<OwnUserProfileResponse>> UploadMyBanner(
            [FromForm] UploadProfileAssetRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileAssetService.UploadBannerAsync(
                userId.Value,
                request,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpPost("me/profile/banner/{assetId:guid}")]
        public async Task<ActionResult<OwnUserProfileResponse>> SetMyBanner(
            Guid assetId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileAssetService.SetBannerAsync(
                userId.Value,
                assetId,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpDelete("me/profile/banner")]
        public async Task<ActionResult<OwnUserProfileResponse>> ClearMyBanner(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._userProfileAssetService.ClearBannerAsync(
                userId.Value,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = this.User.FindFirstValue("userId");

            return Guid.TryParse(userIdValue, out var userId)
                ? userId
                : null;
        }
    }
}
