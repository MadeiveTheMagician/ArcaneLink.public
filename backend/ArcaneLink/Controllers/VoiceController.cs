using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Voice;
using ArcaneLink.Services.Voice.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers;

[ApiController]
[Authorize]
[Route("api/voice")]
public sealed class VoiceController : ControllerBase
{
    private readonly ITurnCredentialService _turnCredentials;

    public VoiceController(ITurnCredentialService turnCredentials)
    {
        this._turnCredentials = turnCredentials;
    }

    [HttpGet("ice-servers")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.TurnCredentials)]
    [ProducesResponseType<VoiceIceServerResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status503ServiceUnavailable)]
    public ActionResult<VoiceIceServerResponse> GetIceServers()
    {
        this.Response.Headers.CacheControl = "no-store";
        this.Response.Headers.Pragma = "no-cache";

        var userIdValue = this.User.FindFirstValue("userId");
        if (!Guid.TryParse(userIdValue, out var userId))
        {
            return this.Unauthorized();
        }

        if (!this._turnCredentials.IsAvailable)
        {
            var problem = new ProblemDetails
            {
                Title = "Voice relay credentials are unavailable.",
                Detail = "The server voice relay is not configured.",
                Status = StatusCodes.Status503ServiceUnavailable,
                Instance = this.HttpContext.Request.Path
            };
            problem.Extensions["code"] = "turn_credentials_unavailable";
            return this.StatusCode(StatusCodes.Status503ServiceUnavailable, problem);
        }

        return this.Ok(this._turnCredentials.IssueForUser(userId));
    }
}
