using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
[Route("api/private-space-folders")]
public sealed class PrivateSpaceFoldersController : ControllerBase
{
    private readonly IPrivateSpaceFolderService _folderService;

    public PrivateSpaceFoldersController(IPrivateSpaceFolderService folderService)
    {
        this._folderService = folderService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PrivateSpaceFolderResponse>>> GetFolders(CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        return userId == null
            ? this.Unauthorized()
            : this.Ok(await this._folderService.GetFoldersAsync(userId.Value, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<PrivateSpaceFolderResponse>> CreateFolder(
        [FromBody] UpsertPrivateSpaceFolderRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._folderService.CreateFolderAsync(userId.Value, request, cancellationToken);
        if (result.Folder != null) return this.Ok(result.Folder);
        return result.ErrorCode == "folder_limit_reached"
            ? this.Conflict(new { code = result.ErrorCode })
            : this.BadRequest(new { code = result.ErrorCode });
    }

    [HttpPut("{folderId:guid}")]
    public async Task<ActionResult<PrivateSpaceFolderResponse>> UpdateFolder(
        Guid folderId,
        [FromBody] UpsertPrivateSpaceFolderRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._folderService.UpdateFolderAsync(userId.Value, folderId, request, cancellationToken);
        return result.Folder == null
            ? this.BadRequest(new { code = result.ErrorCode })
            : this.Ok(result.Folder);
    }

    [HttpDelete("{folderId:guid}")]
    public async Task<IActionResult> DeleteFolder(Guid folderId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._folderService.DeleteFolderAsync(userId.Value, folderId, cancellationToken) ? this.NoContent() : this.NotFound();
    }

    [HttpPut("{folderId:guid}/spaces/{spaceId:guid}")]
    public async Task<IActionResult> AddSpace(Guid folderId, Guid spaceId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._folderService.AddSpaceAsync(userId.Value, folderId, spaceId, cancellationToken) ? this.NoContent() : this.NotFound();
    }

    [HttpDelete("{folderId:guid}/spaces/{spaceId:guid}")]
    public async Task<IActionResult> RemoveSpace(Guid folderId, Guid spaceId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._folderService.RemoveSpaceAsync(userId.Value, folderId, spaceId, cancellationToken) ? this.NoContent() : this.NotFound();
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> ReorderFolders([FromBody] ReorderPrivateSpaceFoldersRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._folderService.ReorderFoldersAsync(userId.Value, request.FolderIds, cancellationToken) ? this.NoContent() : this.BadRequest();
    }

    [HttpPut("{folderId:guid}/spaces/reorder")]
    public async Task<IActionResult> ReorderItems(Guid folderId, [FromBody] ReorderPrivateSpaceFolderItemsRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._folderService.ReorderItemsAsync(userId.Value, folderId, request.SpaceIds, cancellationToken) ? this.NoContent() : this.BadRequest();
    }

    [HttpPut("{folderId:guid}/spaces/{spaceId:guid}/pin")]
    public async Task<ActionResult<PrivateSpaceFolderResponse>> SetPinned(
        Guid folderId,
        Guid spaceId,
        [FromBody] SetPrivateSpacePinnedRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var folder = await this._folderService.SetPinnedAsync(
            userId.Value,
            folderId,
            spaceId,
            request.IsPinned,
            cancellationToken);
        return folder == null ? this.NotFound() : this.Ok(folder);
    }

    [HttpPut("{folderId:guid}/order-lock")]
    public async Task<ActionResult<PrivateSpaceFolderResponse>>
        SetOrderLocked(
            Guid folderId,
            [FromBody] SetPrivateSpaceFolderOrderLockRequest request,
            CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();

        var folder = await this._folderService.SetOrderLockedAsync(
            userId.Value,
            folderId,
            request.IsLocked,
            cancellationToken);
        return folder == null ? this.NotFound() : this.Ok(folder);
    }

    private Guid? GetCurrentUserId()
    {
        var rawUserId = this.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? this.User.FindFirstValue("sub");
        return Guid.TryParse(rawUserId, out var userId) ? userId : null;
    }
}
