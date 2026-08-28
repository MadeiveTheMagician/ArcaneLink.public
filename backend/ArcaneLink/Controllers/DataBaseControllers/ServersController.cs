using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Route("api/servers")]
    public class ServersController : ControllerBase
    {
        private readonly IServerCommandService _serverCommands;
        private readonly IServerQueryService _serverQueries;
        private readonly IServerDiscoveryService _serverDiscoveryService;

        public ServersController(
            IServerCommandService serverCommands,
            IServerQueryService serverQueries,
            IServerDiscoveryService serverDiscoveryService)
        {
            this._serverCommands = serverCommands;
            this._serverQueries = serverQueries;
            this._serverDiscoveryService = serverDiscoveryService;
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<ServerResponse>> CreateServer(
            [FromBody] CreateServerRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._serverCommands.CreateServerAsync(
                userId.Value,
                request,
                cancellationToken);

            return this.CreatedAtAction(
                nameof(GetServer),
                new
                {
                    id = response.Id
                },
                response);
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<IReadOnlyList<ServerMemberResponse>>> GetMyServers(
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._serverQueries.GetMyServersAsync(
                userId.Value,
                cancellationToken);

            return this.Ok(response);
        }

        [Authorize]
        [HttpGet("discover")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.DiscoverySearch)]
        public async Task<ActionResult<IReadOnlyList<ServerDiscoveryResponse>>> DiscoverServers(
            [FromQuery] ServerDiscoveryQuery query,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            return this.Ok(await this._serverDiscoveryService.DiscoverServersAsync(
                userId.Value,
                query,
                cancellationToken));
        }

        [Authorize]
        [HttpGet("{id:guid}")]
        public async Task<ActionResult<ServerResponse>> GetServer(
            Guid id,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._serverQueries.GetServerAsync(
                userId.Value,
                id,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpGet("by-slug/{slug}")]
        public async Task<ActionResult<ServerResponse>> GetServerBySlug(
            string slug,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._serverQueries.GetServerBySlugAsync(
                userId.Value,
                slug,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpPatch("{id:guid}")]
        public async Task<ActionResult<ServerResponse>> UpdateServer(
            Guid id,
            [FromBody] UpdateServerRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var response = await this._serverCommands.UpdateServerAsync(
                userId.Value,
                id,
                request,
                cancellationToken);

            if (response == null)
            {
                return this.NotFound();
            }

            return this.Ok(response);
        }

        [Authorize]
        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> DeleteServer(
            Guid id,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();

            if (userId == null)
            {
                return this.Unauthorized();
            }

            var isDeleted = await this._serverCommands.DeleteServerAsync(
                userId.Value,
                id,
                cancellationToken);

            return isDeleted
                ? this.NoContent()
                : this.NotFound();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = this.User.FindFirstValue("userId");

            return Guid.TryParse(userIdValue, out var userId)
                ? userId
                : null;
        }
    }
}
