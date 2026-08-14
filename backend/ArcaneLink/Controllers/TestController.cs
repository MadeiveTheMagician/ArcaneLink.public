using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ArcaneLink.Controllers
{
    [ApiController]
    [Route("api/test")]
    public class TestController : ControllerBase
    {
        [Authorize]
        [HttpGet("me")]
        public IActionResult Me()
        {
            var userId = User.FindFirstValue("userId");
            var login = User.FindFirstValue(ClaimTypes.Name);

            return Ok(new
            {
                userId,
                login
            });
        }
    }
}