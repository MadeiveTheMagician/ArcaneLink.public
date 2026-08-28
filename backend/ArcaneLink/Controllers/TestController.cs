using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers;

[ApiController]
[Route("api/test")]
public class TestController : ControllerBase
{
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        var userId = this.User.FindFirstValue("userId");
        var login = this.User.FindFirstValue(ClaimTypes.Name);

        return this.Ok(new
        {
            userId,
            login
        });
    }
}
