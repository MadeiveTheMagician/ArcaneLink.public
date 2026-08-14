using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
[Route("api/servers/{serverId:guid}/members/me/display-color")]
public sealed class ServerMemberDisplayColorController : ControllerBase
{
    private readonly IServerMemberDisplayColorService _displayColor;

    public ServerMemberDisplayColorController(
        IServerMemberDisplayColorService displayColor)
    {
        _displayColor = displayColor;
    }

    [HttpGet]
    public async Task<ActionResult<ServerMemberDisplayColorResponse>> Get(
        Guid serverId,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var response = await _displayColor.GetAsync(
            userId.Value,
            serverId,
            cancellationToken);
        return response == null ? NotFound() : Ok(response);
    }

    [HttpPatch]
    public async Task<ActionResult<ServerMemberDisplayColorResponse>> Update(
        Guid serverId,
        [FromBody] UpdateServerMemberDisplayColorRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var result = await _displayColor.UpdateAsync(
            userId.Value,
            serverId,
            request,
            cancellationToken);
        return result.Status switch
        {
            UpdateServerMemberDisplayColorStatus.Success => Ok(result.DisplayColor),
            UpdateServerMemberDisplayColorStatus.InvalidRequest => BadRequest(
                new { code = "invalid_server_member_display_color" }),
            UpdateServerMemberDisplayColorStatus.Conflict => Conflict(
                new { code = "server_member_display_color_conflict" }),
            _ => NotFound()
        };
    }

    private Guid? GetCurrentUserId()
    {
        var userIdValue = User.FindFirstValue("userId");
        return Guid.TryParse(userIdValue, out var userId) ? userId : null;
    }
}
