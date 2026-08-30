using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Messages.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
[Route("api/servers/{serverId:guid}/spaces/{spaceId:guid}/messages")]
[Route("api/servers/{serverId:guid}/voice-spaces/{spaceId:guid}/chat/messages")]
public class SpaceMessagesController : ControllerBase, IAsyncActionFilter
{
    private readonly ISpaceMessageService _messageService;
    private readonly MessageReactionService _reactionService;
    private readonly SpaceReadStateService _readStateService;
    private readonly SpaceMessageMentionService _mentionService;
    private readonly AppDbContext _db;

    public SpaceMessagesController(
        ISpaceMessageService messageService,
        MessageReactionService reactionService,
        SpaceReadStateService readStateService,
        SpaceMessageMentionService mentionService,
        AppDbContext db)
    {
        this._messageService = messageService;
        this._reactionService = reactionService;
        this._readStateService = readStateService;
        this._mentionService = mentionService;
        this._db = db;
    }

    [NonAction]
    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        if (this.Request.Path.Value?.Contains(
                "/voice-spaces/",
                StringComparison.OrdinalIgnoreCase) == true &&
            context.ActionArguments.TryGetValue("serverId", out var serverValue) &&
            serverValue is Guid serverId &&
            context.ActionArguments.TryGetValue("spaceId", out var spaceValue) &&
            spaceValue is Guid spaceId)
        {
            var messageSpaceId = await this.ResolveRoutedMessageSpaceIdAsync(
                serverId,
                spaceId,
                context.HttpContext.RequestAborted);
            if (!messageSpaceId.HasValue)
            {
                context.Result = this.NotFound();
                return;
            }

            context.ActionArguments["spaceId"] = messageSpaceId.Value;
        }

        await next();
    }

    [HttpGet("mention-candidates")]
    public async Task<ActionResult<SpaceMentionAutocompleteResponse>> GetMentionOptions(
        Guid serverId,
        Guid spaceId,
        [FromQuery] string? query = null,
        CancellationToken cancellationToken = default)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._mentionService.GetServerAutocompleteAsync(
            userId.Value,
            serverId,
            spaceId,
            query,
            cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SpaceMessageResponse>>> GetMessages(
        Guid serverId,
        Guid spaceId,
        [FromQuery] int limit = 100,
        [FromQuery] DateTime? beforeCreatedAt = null,
        [FromQuery] Guid? beforeId = null,
        CancellationToken cancellationToken = default)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        if (beforeId.HasValue && !beforeCreatedAt.HasValue)
        {
            return this.BadRequest(new { code = "invalid_message_cursor" });
        }

        var response = await this._messageService.GetMessagesAsync(
            userId.Value,
            serverId,
            spaceId,
            limit,
            beforeCreatedAt,
            beforeId,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpGet("/api/servers/{serverId:guid}/messages/search")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.DiscoverySearch)]
    public async Task<ActionResult<IReadOnlyList<SpaceMessageResponse>>> SearchMessages(
        Guid serverId,
        [FromQuery] string? query = null,
        [FromQuery] Guid? senderUserId = null,
        [FromQuery] Guid? spaceId = null,
        [FromQuery] string? attachmentType = null,
        [FromQuery] int limit = 30,
        CancellationToken cancellationToken = default)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._messageService.SearchMessagesAsync(
            userId.Value,
            serverId,
            query ?? string.Empty,
            senderUserId,
            spaceId,
            attachmentType,
            limit,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<SpaceMessageResponse>> CreateMessage(
        Guid serverId,
        Guid spaceId,
        [FromBody] CreateSpaceMessageRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._messageService.CreateMessageAsync(
            userId.Value,
            serverId,
            spaceId,
            request,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpGet("pinned")]
    public async Task<ActionResult<IReadOnlyList<SpaceMessageResponse>>> GetPinnedMessages(
        Guid serverId,
        Guid spaceId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._messageService.GetPinnedMessagesAsync(
            userId.Value,
            serverId,
            spaceId,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPost("attachments")]
    [Consumes("multipart/form-data")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Uploads)]
    public async Task<ActionResult<AssetResponse>> UploadAttachment(
        Guid serverId,
        Guid spaceId,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._messageService.UploadAttachmentAsync(
            userId.Value,
            serverId,
            spaceId,
            file,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPatch("{messageId:guid}")]
    public async Task<ActionResult<SpaceMessageResponse>> UpdateMessage(
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        [FromBody] UpdateSpaceMessageRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._messageService.UpdateMessageAsync(
            userId.Value,
            serverId,
            spaceId,
            messageId,
            request,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpDelete("{messageId:guid}")]
    public async Task<IActionResult> DeleteMessage(
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        return await this._messageService.DeleteMessageAsync(
            userId.Value,
            serverId,
            spaceId,
            messageId,
            cancellationToken)
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpPost("{messageId:guid}/pin")]
    public async Task<ActionResult<SpaceMessageResponse>> PinMessage(
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._messageService.PinMessageAsync(
            userId.Value,
            serverId,
            spaceId,
            messageId,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpDelete("{messageId:guid}/pin")]
    public async Task<IActionResult> UnpinMessage(
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        return await this._messageService.UnpinMessageAsync(
            userId.Value,
            serverId,
            spaceId,
            messageId,
            cancellationToken)
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpPut("read-state")]
    public async Task<ActionResult<SpaceReadStateResponse>> MarkRead(
        Guid serverId,
        Guid spaceId,
        [FromBody] MarkSpaceReadRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var response = await this._readStateService.MarkServerSpaceReadAsync(
            userId.Value,
            serverId,
            spaceId,
            request.ThroughMessageId,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPut("{messageId:guid}/reactions")]
    public async Task<ActionResult<SpaceMessageResponse>> AddReaction(
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        [FromBody] SetSpaceMessageReactionRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var result = await this._reactionService.SetServerReactionAsync(
            userId.Value,
            serverId,
            spaceId,
            messageId,
            request.EmojiCode,
            isPresent: true,
            cancellationToken);

        return this.ToReactionActionResult(result);
    }

    [HttpDelete("{messageId:guid}/reactions")]
    public async Task<ActionResult<SpaceMessageResponse>> RemoveReaction(
        Guid serverId,
        Guid spaceId,
        Guid messageId,
        [FromBody] SetSpaceMessageReactionRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var result = await this._reactionService.SetServerReactionAsync(
            userId.Value,
            serverId,
            spaceId,
            messageId,
            request.EmojiCode,
            isPresent: false,
            cancellationToken);

        return this.ToReactionActionResult(result);
    }

    private ActionResult<SpaceMessageResponse> ToReactionActionResult(
        MessageReactionMutationResult result)
    {
        return result.Status switch
        {
            MessageReactionMutationStatus.Success => this.Ok(result.Message),
            MessageReactionMutationStatus.InvalidEmoji => this.BadRequest(
                new { code = "invalid_emoji" }),
            _ => this.NotFound()
        };
    }

    private async Task<Guid?> ResolveRoutedMessageSpaceIdAsync(
        Guid serverId,
        Guid spaceId,
        CancellationToken cancellationToken)
    {
        return await this._db.Spaces
            .AsNoTracking()
            .Where(space =>
                space.Id == spaceId &&
                space.ServerId == serverId &&
                space.TypeId == SpaceIds.TypeVoiceRoom &&
                space.DeletedAt == null &&
                space.VoiceChatSpace != null &&
                space.VoiceChatSpace.DeletedAt == null)
            .Select(space => (Guid?)space.VoiceChatSpace!.Id)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private Guid? GetCurrentUserId()
    {
        var userIdValue = this.User.FindFirstValue("userId");
        return Guid.TryParse(userIdValue, out var userId) ? userId : null;
    }
}
