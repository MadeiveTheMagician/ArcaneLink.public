using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    [Route("api/servers/{serverId:guid}/member-profiles")]
    public sealed class ServerMemberProfilesController : ControllerBase
    {
        private readonly IServerMemberProfileService _profiles;

        public ServerMemberProfilesController(IServerMemberProfileService profiles)
        {
            this._profiles = profiles;
        }

        [HttpGet("me")]
        public async Task<ActionResult<OwnServerMemberProfileResponse>> GetMine(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var currentUserId = this.GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return this.Unauthorized();
            }

            var response = await this._profiles.GetOwnAsync(
                currentUserId.Value,
                serverId,
                cancellationToken);
            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpGet("{userId:guid}")]
        public Task<ActionResult<ServerMemberViewerProfileResponse>> GetByUserId(
            Guid serverId,
            Guid userId,
            CancellationToken cancellationToken)
        {
            return this.GetProfile(serverId, userId, cancellationToken);
        }

        [HttpPatch("me")]
        public async Task<ActionResult<OwnServerMemberProfileResponse>> UpdateMine(
            Guid serverId,
            [FromBody] UpdateServerMemberProfileRequest request,
            CancellationToken cancellationToken)
        {
            var currentUserId = this.GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return this.Unauthorized();
            }

            var response = await this._profiles.UpdateOwnAsync(
                currentUserId.Value,
                serverId,
                request,
                cancellationToken);
            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpPost("me/avatar/{assetId:guid}")]
        public async Task<ActionResult<OwnServerMemberProfileResponse>> SetMyAvatar(
            Guid serverId,
            Guid assetId,
            [FromBody] SetServerMemberProfileAvatarRequest request,
            CancellationToken cancellationToken)
        {
            var currentUserId = this.GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return this.Unauthorized();
            }

            var response = await this._profiles.SetOwnAvatarAsync(
                currentUserId.Value,
                serverId,
                assetId,
                request,
                cancellationToken);
            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpDelete("me")]
        public async Task<ActionResult<OwnServerMemberProfileResponse>> ResetMine(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var currentUserId = this.GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return this.Unauthorized();
            }

            var response = await this._profiles.ResetOwnAsync(
                currentUserId.Value,
                serverId,
                cancellationToken);
            return response == null ? this.NotFound() : this.Ok(response);
        }

        private async Task<ActionResult<ServerMemberViewerProfileResponse>> GetProfile(
            Guid serverId,
            Guid? targetUserId,
            CancellationToken cancellationToken)
        {
            var currentUserId = this.GetCurrentUserId();
            if (!currentUserId.HasValue || !targetUserId.HasValue)
            {
                return this.Unauthorized();
            }

            var response = await this._profiles.GetAsync(
                currentUserId.Value,
                serverId,
                targetUserId.Value,
                cancellationToken);
            return response == null ? this.NotFound() : this.Ok(response);
        }

        private Guid? GetCurrentUserId()
        {
            return Guid.TryParse(
                this.User.FindFirstValue("userId"),
                out var userId)
                ? userId
                : null;
        }
    }
}
