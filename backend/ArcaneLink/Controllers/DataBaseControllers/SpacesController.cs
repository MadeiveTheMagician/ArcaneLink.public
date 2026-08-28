using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    public class SpacesController : ControllerBase
    {
        private readonly ISpaceService _spaceService;

        public SpacesController(ISpaceService spaceService)
        {
            this._spaceService = spaceService;
        }

        [HttpGet("api/space-types")]
        public async Task<ActionResult<IReadOnlyList<SpaceTypeResponse>>> GetSpaceTypes(
            CancellationToken cancellationToken)
        {
            return this.Ok(await this._spaceService.GetSpaceTypesAsync(cancellationToken));
        }

        [HttpGet("api/servers/{serverId:guid}/spaces")]
        public async Task<ActionResult<IReadOnlyList<SpaceResponse>>> GetServerSpaces(
            Guid serverId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null) return this.Unauthorized();

            var response = await this._spaceService.GetServerSpacesAsync(
                userId.Value,
                serverId,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpPost("api/servers/{serverId:guid}/spaces")]
        public async Task<ActionResult<SpaceResponse>> CreateSpace(
            Guid serverId,
            [FromBody] CreateSpaceRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null) return this.Unauthorized();

            var response = await this._spaceService.CreateSpaceAsync(
                userId.Value,
                serverId,
                request,
                cancellationToken);

            return response == null
                ? this.NotFound()
                : this.CreatedAtAction(
                    nameof(GetServerSpaces),
                    new { serverId },
                    response);
        }

        [HttpPatch("api/servers/{serverId:guid}/spaces/{spaceId:guid}")]
        public async Task<ActionResult<SpaceResponse>> UpdateSpace(
            Guid serverId,
            Guid spaceId,
            [FromBody] UpdateSpaceRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null) return this.Unauthorized();

            var response = await this._spaceService.UpdateSpaceAsync(
                userId.Value,
                serverId,
                spaceId,
                request,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpDelete("api/servers/{serverId:guid}/spaces/{spaceId:guid}")]
        public async Task<IActionResult> DeleteSpace(
            Guid serverId,
            Guid spaceId,
            [FromBody] DeleteSpaceRequest? request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null) return this.Unauthorized();

            return await this._spaceService.DeleteSpaceAsync(
                userId.Value,
                serverId,
                spaceId,
                request ?? new DeleteSpaceRequest(),
                cancellationToken)
                ? this.NoContent()
                : this.NotFound();
        }

        [HttpPut("api/servers/{serverId:guid}/spaces/reorder")]
        public async Task<IActionResult> ReorderSpaces(
            Guid serverId,
            [FromBody] ReorderSpacesRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null) return this.Unauthorized();

            return await this._spaceService.ReorderSpacesAsync(
                userId.Value,
                serverId,
                request,
                cancellationToken)
                ? this.NoContent()
                : this.NotFound();
        }

        [HttpPut("api/servers/{serverId:guid}/spaces/{spaceId:guid}/permission-overrides")]
        public async Task<ActionResult<SpacePermissionOverrideResponse>> UpsertPermissionOverride(
            Guid serverId,
            Guid spaceId,
            [FromBody] UpsertSpacePermissionOverrideRequest request,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null) return this.Unauthorized();

            var response = await this._spaceService.UpsertPermissionOverrideAsync(
                userId.Value,
                serverId,
                spaceId,
                request,
                cancellationToken);

            return response == null ? this.NotFound() : this.Ok(response);
        }

        [HttpDelete("api/servers/{serverId:guid}/spaces/{spaceId:guid}/permission-overrides/{overrideId:guid}")]
        public async Task<IActionResult> DeletePermissionOverride(
            Guid serverId,
            Guid spaceId,
            Guid overrideId,
            CancellationToken cancellationToken)
        {
            var userId = this.GetCurrentUserId();
            if (userId == null) return this.Unauthorized();

            return await this._spaceService.DeletePermissionOverrideAsync(
                userId.Value,
                serverId,
                spaceId,
                overrideId,
                cancellationToken)
                ? this.NoContent()
                : this.NotFound();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = this.User.FindFirstValue("userId");
            return Guid.TryParse(userIdValue, out var userId) ? userId : null;
        }
    }
}
