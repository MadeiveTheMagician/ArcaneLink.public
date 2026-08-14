using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.PrivateSpaces;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    [Route("api/private-spaces")]
    public class PrivateSpacesController : ControllerBase
    {
        private readonly IPrivateSpaceService _privateSpaceService;
        private readonly IPrivateSpaceMembershipService _privateSpaceMembershipService;
        private readonly IPrivateSpaceMessageService _privateSpaceMessageService;
        private readonly PrivateSpacePersonalAvatarService _personalAvatarService;
        private readonly MessageReactionService _reactionService;
        private readonly SpaceReadStateService _readStateService;

        public PrivateSpacesController(
            IPrivateSpaceService privateSpaceService,
            IPrivateSpaceMembershipService privateSpaceMembershipService,
            IPrivateSpaceMessageService privateSpaceMessageService,
            PrivateSpacePersonalAvatarService personalAvatarService,
            MessageReactionService reactionService,
            SpaceReadStateService readStateService)
        {
            _privateSpaceService = privateSpaceService;
            _privateSpaceMembershipService = privateSpaceMembershipService;
            _privateSpaceMessageService = privateSpaceMessageService;
            _personalAvatarService = personalAvatarService;
            _reactionService = reactionService;
            _readStateService = readStateService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<PrivateSpaceResponse>>> GetMyPrivateSpaces(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            return Ok(await _privateSpaceService.GetMyPrivateSpacesAsync(
                userId.Value,
                cancellationToken));
        }

        [HttpGet("{spaceId:guid}")]
        public async Task<ActionResult<PrivateSpaceResponse>> GetPrivateSpace(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceService.GetPrivateSpaceAsync(
                userId.Value,
                spaceId,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpPost]
        public async Task<ActionResult<PrivateSpaceResponse>> CreatePrivateSpace(
            [FromBody] CreatePrivateSpaceRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceService.CreatePrivateSpaceAsync(
                userId.Value,
                request,
                cancellationToken);

            return response == null
                ? BadRequest()
                : CreatedAtAction(
                    nameof(GetPrivateSpace),
                    new { spaceId = response.SpaceId },
                    response);
        }

        [HttpPost("direct/{targetUserId:guid}")]
        public async Task<ActionResult<PrivateSpaceResponse>> GetOrCreateDirectSpace(
            Guid targetUserId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceService.GetOrCreateDirectSpaceAsync(
                userId.Value,
                targetUserId,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpPatch("{spaceId:guid}/settings/me")]
        public async Task<ActionResult<PrivateSpaceResponse>>
            UpdateMyPrivateSpaceSettings(
                Guid spaceId,
                [FromBody] UpdatePrivateSpacePersonalSettingsRequest request,
                CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceService
                .UpdatePersonalSettingsAsync(
                    userId.Value,
                    spaceId,
                    request,
                    cancellationToken);
            return response == null ? BadRequest() : Ok(response);
        }

        [HttpPost("{spaceId:guid}/settings/me/avatar/upload")]
        [Consumes("multipart/form-data")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Uploads)]
        public async Task<ActionResult<PrivateSpaceResponse>>
            UploadMyPrivateSpaceAvatar(
                Guid spaceId,
                [FromForm] UploadPrivateSpacePersonalAvatarRequest request,
                CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (!await _personalAvatarService.UploadAsync(
                    userId.Value,
                    spaceId,
                    request,
                    cancellationToken))
            {
                return NotFound();
            }

            var response = await _privateSpaceService.GetPrivateSpaceAsync(
                userId.Value,
                spaceId,
                cancellationToken);
            return response == null ? NotFound() : Ok(response);
        }

        [HttpPatch("{spaceId:guid}/settings")]
        public async Task<ActionResult<PrivateSpaceResponse>>
            UpdateGroupPrivateSpaceSettings(
                Guid spaceId,
                [FromBody] UpdateGroupPrivateSpaceRequest request,
                CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceService.UpdateGroupSettingsAsync(
                userId.Value,
                spaceId,
                request,
                cancellationToken);
            return response == null ? BadRequest() : Ok(response);
        }

        [HttpPost("{spaceId:guid}/members")]
        public async Task<ActionResult<PrivateSpaceMembershipMutationResponse>> AddMember(
            Guid spaceId,
            [FromBody] AddPrivateSpaceMemberRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceMembershipService.AddMemberAsync(
                userId.Value,
                spaceId,
                request,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpDelete("{spaceId:guid}/members/me")]
        public async Task<IActionResult> Leave(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            return await _privateSpaceMembershipService.LeaveAsync(
                userId.Value,
                spaceId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpPost("{spaceId:guid}/history/clear")]
        public async Task<IActionResult> ClearHistory(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            return await _privateSpaceMembershipService.ClearHistoryAsync(
                userId.Value,
                spaceId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpDelete("{spaceId:guid}/members/{memberId:guid}")]
        public async Task<IActionResult> RemoveMember(
            Guid spaceId,
            Guid memberId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            return await _privateSpaceMembershipService.RemoveMemberAsync(
                userId.Value,
                spaceId,
                memberId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpGet("{spaceId:guid}/messages")]
        public async Task<ActionResult<IReadOnlyList<SpaceMessageResponse>>> GetMessages(
            Guid spaceId,
            [FromQuery] int limit = 100,
            [FromQuery] DateTime? beforeCreatedAt = null,
            [FromQuery] Guid? beforeId = null,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            if (beforeId.HasValue && !beforeCreatedAt.HasValue)
            {
                return BadRequest(new { code = "invalid_message_cursor" });
            }

            var response = await _privateSpaceMessageService.GetMessagesAsync(
                userId.Value,
                spaceId,
                limit,
                beforeCreatedAt,
                beforeId,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpGet("{spaceId:guid}/messages/search")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.DiscoverySearch)]
        public async Task<ActionResult<IReadOnlyList<SpaceMessageResponse>>> SearchMessages(
            Guid spaceId,
            [FromQuery] string? query = null,
            [FromQuery] Guid? senderUserId = null,
            [FromQuery] string? attachmentType = null,
            [FromQuery] int limit = 30,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceMessageService.SearchMessagesAsync(
                userId.Value,
                spaceId,
                query ?? string.Empty,
                senderUserId,
                attachmentType,
                limit,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpPost("{spaceId:guid}/messages")]
        public async Task<ActionResult<SpaceMessageResponse>> CreateMessage(
            Guid spaceId,
            [FromBody] CreateSpaceMessageRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceMessageService.CreateMessageAsync(
                userId.Value,
                spaceId,
                request,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpGet("{spaceId:guid}/messages/pinned")]
        public async Task<ActionResult<IReadOnlyList<SpaceMessageResponse>>> GetPinnedMessages(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceMessageService.GetPinnedMessagesAsync(
                userId.Value,
                spaceId,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpPost("{spaceId:guid}/messages/attachments")]
        [Consumes("multipart/form-data")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Uploads)]
        public async Task<ActionResult<AssetResponse>> UploadAttachment(
            Guid spaceId,
            [FromForm] IFormFile file,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceMessageService.UploadAttachmentAsync(
                userId.Value,
                spaceId,
                file,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpPatch("{spaceId:guid}/messages/{messageId:guid}")]
        public async Task<ActionResult<SpaceMessageResponse>> UpdateMessage(
            Guid spaceId,
            Guid messageId,
            [FromBody] UpdateSpaceMessageRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceMessageService.UpdateMessageAsync(
                userId.Value,
                spaceId,
                messageId,
                request,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpDelete("{spaceId:guid}/messages/{messageId:guid}")]
        public async Task<IActionResult> DeleteMessage(
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken,
            [FromQuery] string scope = "everyone")
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            if (scope is not ("me" or "everyone"))
            {
                return BadRequest(new { code = "invalid_delete_scope" });
            }

            return await _privateSpaceMessageService.DeleteMessageAsync(
                userId.Value,
                spaceId,
                messageId,
                scope,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpGet("{spaceId:guid}/messages/trash")]
        public async Task<ActionResult<IReadOnlyList<PrivateSpaceTrashMessageResponse>>> GetTrash(
            Guid spaceId,
            [FromQuery] int limit = 100,
            [FromQuery] DateTime? beforeDeletedAt = null,
            [FromQuery] Guid? beforeId = null,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            if (beforeId.HasValue && !beforeDeletedAt.HasValue)
            {
                return BadRequest(new { code = "invalid_trash_cursor" });
            }

            var response = await _privateSpaceMessageService.GetTrashAsync(
                userId.Value,
                spaceId,
                limit,
                beforeDeletedAt,
                beforeId,
                cancellationToken);
            return response == null ? NotFound() : Ok(response);
        }

        [HttpDelete("{spaceId:guid}/messages/trash")]
        public async Task<IActionResult> ClearTrash(
            Guid spaceId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            return await _privateSpaceMessageService.ClearTrashAsync(
                userId.Value,
                spaceId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpPost("{spaceId:guid}/messages/{messageId:guid}/restore")]
        public async Task<IActionResult> RestoreMessage(
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            return await _privateSpaceMessageService.RestoreMessageAsync(
                userId.Value,
                spaceId,
                messageId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpPost("{spaceId:guid}/messages/{messageId:guid}/pin")]
        public async Task<ActionResult<SpaceMessageResponse>> PinMessage(
            Guid spaceId,
            Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _privateSpaceMessageService.PinMessageAsync(
                userId.Value,
                spaceId,
                messageId,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpPut("{spaceId:guid}/messages/read-state")]
        public async Task<ActionResult<SpaceReadStateResponse>> MarkRead(
            Guid spaceId,
            [FromBody] MarkSpaceReadRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var response = await _readStateService.MarkPrivateSpaceReadAsync(
                userId.Value,
                spaceId,
                request.ThroughMessageId,
                cancellationToken);

            return response == null ? NotFound() : Ok(response);
        }

        [HttpPut("read-state/all")]
        public async Task<ActionResult<MarkAllPrivateSpacesReadResponse>>
            MarkAllRead(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            return Ok(await _readStateService.MarkAllPrivateSpacesReadAsync(
                userId.Value,
                cancellationToken));
        }

        [HttpPut("{spaceId:guid}/messages/{messageId:guid}/reactions")]
        public async Task<ActionResult<SpaceMessageResponse>> AddReaction(
            Guid spaceId,
            Guid messageId,
            [FromBody] SetSpaceMessageReactionRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var result = await _reactionService.SetPrivateReactionAsync(
                userId.Value,
                spaceId,
                messageId,
                request.EmojiCode,
                isPresent: true,
                cancellationToken);

            return ToReactionActionResult(result);
        }

        [HttpDelete("{spaceId:guid}/messages/{messageId:guid}/reactions")]
        public async Task<ActionResult<SpaceMessageResponse>> RemoveReaction(
            Guid spaceId,
            Guid messageId,
            [FromBody] SetSpaceMessageReactionRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var result = await _reactionService.SetPrivateReactionAsync(
                userId.Value,
                spaceId,
                messageId,
                request.EmojiCode,
                isPresent: false,
                cancellationToken);

            return ToReactionActionResult(result);
        }

        private ActionResult<SpaceMessageResponse> ToReactionActionResult(
            MessageReactionMutationResult result)
        {
            return result.Status switch
            {
                MessageReactionMutationStatus.Success => Ok(result.Message),
                MessageReactionMutationStatus.InvalidEmoji => BadRequest(
                    new { code = "invalid_emoji" }),
                _ => NotFound()
            };
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue("userId");
            return Guid.TryParse(userIdValue, out var userId) ? userId : null;
        }
    }
}
