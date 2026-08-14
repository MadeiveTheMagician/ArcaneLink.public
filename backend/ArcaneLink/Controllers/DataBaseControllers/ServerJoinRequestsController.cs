using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    public class ServerJoinRequestsController : ControllerBase
    {
        private readonly IServerJoinRequestService _joinRequests;

        public ServerJoinRequestsController(
            IServerJoinRequestService joinRequests)
        {
            _joinRequests = joinRequests;
        }

        [HttpPost("api/servers/{serverId:guid}/join")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
        public async Task<ActionResult<ServerJoinResponse>> Join(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _joinRequests.JoinAsync(
                userId.Value,
                serverId,
                cancellationToken);
            return response == null ? NotFound() : Ok(response);
        }

        [HttpGet("api/servers/{serverId:guid}/join-requests")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
        public async Task<ActionResult<ServerJoinRequestPageResponse>>
            GetPending(
                Guid serverId,
                [FromQuery] DateTime? afterCreatedAt = null,
                [FromQuery] Guid? afterId = null,
                [FromQuery] int limit = 100,
                CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            if (afterCreatedAt.HasValue != afterId.HasValue ||
                limit is < 1 or > 100)
            {
                return BadRequest(new
                {
                    code = "invalid_server_join_request_query"
                });
            }

            var response = await _joinRequests.GetPendingAsync(
                userId.Value,
                serverId,
                afterCreatedAt,
                afterId,
                limit,
                cancellationToken);
            return response == null ? NotFound() : Ok(response);
        }

        [HttpPost(
            "api/servers/{serverId:guid}/join-requests/{requestId:guid}/approve")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
        public async Task<ActionResult<ServerMemberResponse>> Approve(
            Guid serverId,
            Guid requestId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _joinRequests.ApproveAsync(
                userId.Value,
                serverId,
                requestId,
                cancellationToken);
            return response == null ? NotFound() : Ok(response);
        }

        [HttpPost(
            "api/servers/{serverId:guid}/join-requests/{requestId:guid}/decline")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
        public async Task<IActionResult> Decline(
            Guid serverId,
            Guid requestId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            return await _joinRequests.DeclineAsync(
                userId.Value,
                serverId,
                requestId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpDelete("api/servers/{serverId:guid}/join-requests/me")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
        public async Task<IActionResult> Cancel(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            return await _joinRequests.CancelAsync(
                userId.Value,
                serverId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue("userId");
            return Guid.TryParse(userIdValue, out var userId)
                ? userId
                : null;
        }
    }
}
