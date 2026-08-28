using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
[Route("api/servers/{serverId:guid}/members")]
public class ServerMembersController : ControllerBase
{
    private readonly IServerMemberService _serverMemberService;

    public ServerMembersController(IServerMemberService serverMemberService)
    {
        this._serverMemberService = serverMemberService;
    }

    [HttpGet]
    public async Task<ActionResult<ServerMemberPageResponse>> GetMembers(
        Guid serverId,
        [FromQuery] int? afterPriority = null,
        [FromQuery] DateTime? afterJoinedAt = null,
        [FromQuery] Guid? afterId = null,
        [FromQuery] string? q = null,
        [FromQuery] Guid? roleId = null,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var userId = this.GetCurrentUserId();

        if (userId == null)
        {
            return this.Unauthorized();
        }

        var cursorPartCount =
            (afterPriority.HasValue ? 1 : 0) +
            (afterJoinedAt.HasValue ? 1 : 0) +
            (afterId.HasValue ? 1 : 0);
        var normalizedQuery = string.IsNullOrWhiteSpace(q)
            ? null
            : q.Trim();
        if ((cursorPartCount != 0 && cursorPartCount != 3) ||
            afterPriority is < 0 or > 2 ||
            normalizedQuery?.Length > 100 ||
            limit is < 1 or > 100)
        {
            return this.BadRequest(new { code = "invalid_server_member_query" });
        }

        var response = await this._serverMemberService.GetServerMembersAsync(
            userId.Value,
            serverId,
            afterPriority,
            afterJoinedAt,
            afterId,
            normalizedQuery,
            roleId,
            limit,
            cancellationToken);

        return response == null
            ? this.NotFound()
            : this.Ok(response);
    }

    [HttpGet("by-user/{targetUserId:guid}")]
    public async Task<ActionResult<ServerMemberDetailsResponse>> GetMemberByUserId(
        Guid serverId,
        Guid targetUserId,
        CancellationToken cancellationToken = default)
    {
        var userId = this.GetCurrentUserId();

        if (userId == null)
        {
            return this.Unauthorized();
        }

        var response = await this._serverMemberService.GetServerMemberByUserIdAsync(
            userId.Value,
            serverId,
            targetUserId,
            cancellationToken);

        return response == null
            ? this.NotFound()
            : this.Ok(response);
    }

    [HttpDelete("me")]
    public async Task<IActionResult> LeaveServer(
        Guid serverId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();

        if (userId == null)
        {
            return this.Unauthorized();
        }

        var isLeft = await this._serverMemberService.LeaveServerAsync(
            userId.Value,
            serverId,
            cancellationToken);

        return isLeft
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpDelete("{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(
        Guid serverId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();

        if (userId == null)
        {
            return this.Unauthorized();
        }

        var isRemoved = await this._serverMemberService.RemoveServerMemberAsync(
            userId.Value,
            serverId,
            memberId,
            cancellationToken);

        return isRemoved
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpPost("{memberId:guid}/ban")]
    public async Task<ActionResult<ServerBanResponse>> BanMember(
        Guid serverId,
        Guid memberId,
        [FromBody] BanServerMemberRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();

        if (userId == null)
        {
            return this.Unauthorized();
        }

        var response = await this._serverMemberService.BanServerMemberAsync(
            userId.Value,
            serverId,
            memberId,
            request,
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
