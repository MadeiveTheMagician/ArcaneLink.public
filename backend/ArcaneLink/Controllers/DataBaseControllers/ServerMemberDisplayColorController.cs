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
        this._displayColor = displayColor;
    }

    [HttpGet]
    public async Task<ActionResult<ServerMemberDisplayColorResponse>> Get(
        Guid serverId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._displayColor.GetAsync(
            userId.Value,
            serverId,
            cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPatch]
    public async Task<ActionResult<ServerMemberDisplayColorResponse>> Update(
        Guid serverId,
        [FromBody] UpdateServerMemberDisplayColorRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._displayColor.UpdateAsync(
            userId.Value,
            serverId,
            request,
            cancellationToken);
        return result.Status switch
        {
            UpdateServerMemberDisplayColorStatus.Success => this.Ok(result.DisplayColor),
            UpdateServerMemberDisplayColorStatus.InvalidRequest => this.BadRequest(
                new { code = "invalid_server_member_display_color" }),
            UpdateServerMemberDisplayColorStatus.Conflict => this.Conflict(
                new { code = "server_member_display_color_conflict" }),
            _ => this.NotFound()
        };
    }

    private Guid? GetCurrentUserId()
    {
        var userIdValue = this.User.FindFirstValue("userId");
        return Guid.TryParse(userIdValue, out var userId) ? userId : null;
    }
}
