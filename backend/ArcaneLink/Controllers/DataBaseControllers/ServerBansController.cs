using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
[Route("api/servers/{serverId:guid}/bans")]
public class ServerBansController : ControllerBase
{
    private readonly IServerMemberService _serverMemberService;

    public ServerBansController(IServerMemberService serverMemberService)
    {
        this._serverMemberService = serverMemberService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ServerBanResponse>>> GetBans(
        Guid serverId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        var response = await this._serverMemberService.GetServerBansAsync(
            userId.Value,
            serverId,
            cancellationToken);

        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpDelete("{memberId:guid}")]
    public async Task<IActionResult> UnbanMember(
        Guid serverId,
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        var isUnbanned = await this._serverMemberService.UnbanServerMemberAsync(
            userId.Value,
            serverId,
            memberId,
            cancellationToken);

        return isUnbanned ? this.NoContent() : this.NotFound();
    }

    private Guid? GetCurrentUserId()
    {
        var userIdValue = this.User.FindFirstValue("userId");
        return Guid.TryParse(userIdValue, out var userId) ? userId : null;
    }
}
