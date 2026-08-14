using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    [Route("api/private-space-folders")]
    public sealed class PrivateSpaceFoldersController : ControllerBase
    {
        private readonly IPrivateSpaceFolderService _folderService;

        public PrivateSpaceFoldersController(IPrivateSpaceFolderService folderService)
        {
            _folderService = folderService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<PrivateSpaceFolderResponse>>> GetFolders(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            return userId == null
                ? Unauthorized()
                : Ok(await _folderService.GetFoldersAsync(userId.Value, cancellationToken));
        }

        [HttpPost]
        public async Task<ActionResult<PrivateSpaceFolderResponse>> CreateFolder(
            [FromBody] UpsertPrivateSpaceFolderRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            var result = await _folderService.CreateFolderAsync(userId.Value, request, cancellationToken);
            if (result.Folder != null) return Ok(result.Folder);
            return result.ErrorCode == "folder_limit_reached"
                ? Conflict(new { code = result.ErrorCode })
                : BadRequest(new { code = result.ErrorCode });
        }

        [HttpPut("{folderId:guid}")]
        public async Task<ActionResult<PrivateSpaceFolderResponse>> UpdateFolder(
            Guid folderId,
            [FromBody] UpsertPrivateSpaceFolderRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            var result = await _folderService.UpdateFolderAsync(userId.Value, folderId, request, cancellationToken);
            return result.Folder == null
                ? BadRequest(new { code = result.ErrorCode })
                : Ok(result.Folder);
        }

        [HttpDelete("{folderId:guid}")]
        public async Task<IActionResult> DeleteFolder(Guid folderId, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            return await _folderService.DeleteFolderAsync(userId.Value, folderId, cancellationToken) ? NoContent() : NotFound();
        }

        [HttpPut("{folderId:guid}/spaces/{spaceId:guid}")]
        public async Task<IActionResult> AddSpace(Guid folderId, Guid spaceId, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            return await _folderService.AddSpaceAsync(userId.Value, folderId, spaceId, cancellationToken) ? NoContent() : NotFound();
        }

        [HttpDelete("{folderId:guid}/spaces/{spaceId:guid}")]
        public async Task<IActionResult> RemoveSpace(Guid folderId, Guid spaceId, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            return await _folderService.RemoveSpaceAsync(userId.Value, folderId, spaceId, cancellationToken) ? NoContent() : NotFound();
        }

        [HttpPut("reorder")]
        public async Task<IActionResult> ReorderFolders([FromBody] ReorderPrivateSpaceFoldersRequest request, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            return await _folderService.ReorderFoldersAsync(userId.Value, request.FolderIds, cancellationToken) ? NoContent() : BadRequest();
        }

        [HttpPut("{folderId:guid}/spaces/reorder")]
        public async Task<IActionResult> ReorderItems(Guid folderId, [FromBody] ReorderPrivateSpaceFolderItemsRequest request, CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            return await _folderService.ReorderItemsAsync(userId.Value, folderId, request.SpaceIds, cancellationToken) ? NoContent() : BadRequest();
        }

        [HttpPut("{folderId:guid}/spaces/{spaceId:guid}/pin")]
        public async Task<ActionResult<PrivateSpaceFolderResponse>> SetPinned(
            Guid folderId,
            Guid spaceId,
            [FromBody] SetPrivateSpacePinnedRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();
            var folder = await _folderService.SetPinnedAsync(
                userId.Value,
                folderId,
                spaceId,
                request.IsPinned,
                cancellationToken);
            return folder == null ? NotFound() : Ok(folder);
        }

        [HttpPut("{folderId:guid}/order-lock")]
        public async Task<ActionResult<PrivateSpaceFolderResponse>>
            SetOrderLocked(
                Guid folderId,
                [FromBody] SetPrivateSpaceFolderOrderLockRequest request,
                CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var folder = await _folderService.SetOrderLockedAsync(
                userId.Value,
                folderId,
                request.IsLocked,
                cancellationToken);
            return folder == null ? NotFound() : Ok(folder);
        }

        private Guid? GetCurrentUserId()
        {
            var rawUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            return Guid.TryParse(rawUserId, out var userId) ? userId : null;
        }
    }
}
