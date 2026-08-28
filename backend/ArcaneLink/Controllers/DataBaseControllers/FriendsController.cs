using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    [Route("api/friends")]
    public class FriendsController : ControllerBase
    {
        private readonly IFriendService _friendService;

        public FriendsController(IFriendService friendService)
        {
            this._friendService = friendService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<UserFriendResponse>>> GetFriends(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._friendService.GetFriendsAsync(
                userId.Value,
                cancellationToken));
        }

        [HttpGet("requests/incoming")]
        public async Task<ActionResult<IReadOnlyList<FriendRequestResponse>>> GetIncomingRequests(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._friendService.GetIncomingRequestsAsync(
                userId.Value,
                cancellationToken));
        }

        [HttpGet("requests/outgoing")]
        public async Task<ActionResult<IReadOnlyList<FriendRequestResponse>>> GetOutgoingRequests(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._friendService.GetOutgoingRequestsAsync(
                userId.Value,
                cancellationToken));
        }

        [HttpPost("requests")]
        public async Task<ActionResult<FriendRequestResponse>> SendRequest(
            [FromBody] CreateFriendRequestRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._friendService.SendRequestAsync(
                userId.Value,
                request,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpPost("requests/{requestId:guid}/accept")]
        public async Task<ActionResult<FriendRequestResponse>> AcceptRequest(
            Guid requestId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._friendService.AcceptRequestAsync(
                userId.Value,
                requestId,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpPost("requests/{requestId:guid}/decline")]
        public async Task<ActionResult<FriendRequestResponse>> DeclineRequest(
            Guid requestId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._friendService.DeclineRequestAsync(
                userId.Value,
                requestId,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpPost("requests/{requestId:guid}/cancel")]
        public async Task<ActionResult<FriendRequestResponse>> CancelRequest(
            Guid requestId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._friendService.CancelRequestAsync(
                userId.Value,
                requestId,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpDelete("{friendUserId:guid}")]
        public async Task<IActionResult> RemoveFriend(
            Guid friendUserId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var isRemoved = await this._friendService.RemoveFriendAsync(
                userId.Value,
                friendUserId,
                cancellationToken);

            return isRemoved ? this.NoContent() : this.NotFound();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = this.User.FindFirstValue("userId");
            return Guid.TryParse(userIdValue, out var userId) ? userId : null;
        }
    }
}
