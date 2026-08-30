using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
public class ServerGovernanceController : ControllerBase
{
    private readonly IServerGovernanceService _governanceService;

    public ServerGovernanceController(IServerGovernanceService governanceService)
    {
        this._governanceService = governanceService;
    }

    [HttpGet("api/permissions/server")]
    public async Task<ActionResult<IReadOnlyList<PermissionResponse>>> GetPermissions(CancellationToken cancellationToken)
    {
        return this.Ok(await this._governanceService.GetPermissionsAsync(cancellationToken));
    }

    [HttpGet("api/permissions/server/v1")]
    public async Task<ActionResult<ServerPermissionCatalogResponse>> GetPermissionCatalogV1(
        CancellationToken cancellationToken)
    {
        return this.Ok(await this._governanceService.GetPermissionCatalogV1Async(cancellationToken));
    }

    [HttpGet("api/permissions/space")]
    public async Task<ActionResult<IReadOnlyList<PermissionResponse>>> GetSpacePermissions(
        CancellationToken cancellationToken)
    {
        return this.Ok(await this._governanceService.GetSpacePermissionsAsync(cancellationToken));
    }

    [HttpGet("api/server-invites/me")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<IReadOnlyList<ServerInviteResponse>>> GetMyDirectInvites(CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return this.Ok(await this._governanceService.GetMyDirectInvitesAsync(userId.Value, cancellationToken));
    }

    [HttpGet("api/server-invites/target-servers")]
    [HttpGet("api/server-invites/targets")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<IReadOnlyList<ServerMemberResponse>>> GetMyInviteTargetServers(CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return this.Ok(await this._governanceService.GetMyInviteTargetServersAsync(
            userId.Value,
            cancellationToken: cancellationToken));
    }

    [HttpGet("api/server-invites/target-servers/{targetUserId:guid}")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<IReadOnlyList<ServerMemberResponse>>> GetMyInviteTargetServersForUser(Guid targetUserId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return this.Ok(await this._governanceService.GetMyInviteTargetServersAsync(userId.Value, targetUserId, cancellationToken));
    }

    [HttpGet("api/server-invites/{code}")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<ServerInvitePreviewResponse>> GetInvitePreview(string code, CancellationToken cancellationToken)
    {
        var response = await this._governanceService.GetInvitePreviewAsync(
            code,
            this.GetCurrentUserId(),
            cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpGet("api/servers/{serverId:guid}/invites")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<IReadOnlyList<ServerInviteResponse>>> GetInvites(Guid serverId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.GetInvitesAsync(userId.Value, serverId, cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPost("api/servers/{serverId:guid}/invites")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<ServerInviteResponse>> CreateInvite(Guid serverId, [FromBody] CreateServerInviteRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.CreateInviteAsync(userId.Value, serverId, request, cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPost("api/servers/{serverId:guid}/invites/{inviteId:guid}/revoke")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<IActionResult> RevokeInvite(Guid serverId, Guid inviteId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._governanceService.RevokeInviteAsync(userId.Value, serverId, inviteId, cancellationToken)
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpPost("api/server-invites/accept")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<ServerMemberResponse>> AcceptInvite([FromBody] AcceptServerInviteRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.AcceptInviteAsync(userId.Value, request, cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPost("api/server-invites/{inviteId:guid}/accept")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<ActionResult<ServerMemberResponse>> AcceptInvite(Guid inviteId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.AcceptInviteAsync(userId.Value, inviteId, cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPost("api/server-invites/{inviteId:guid}/decline")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Invites)]
    public async Task<IActionResult> DeclineInvite(Guid inviteId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._governanceService.DeclineInviteAsync(
            userId.Value,
            inviteId,
            cancellationToken)
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpPost("api/servers/{serverId:guid}/ownership-transfers")]
    public async Task<ActionResult<ServerOwnershipTransferResponse>> TransferOwnership(Guid serverId, [FromBody] TransferServerOwnershipRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.TransferOwnershipAsync(userId.Value, serverId, request, cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpGet("api/servers/{serverId:guid}/roles")]
    public async Task<ActionResult<IReadOnlyList<ServerRoleResponse>>> GetRoles(
        Guid serverId,
        [FromQuery] ServerRoleQueryRequest query,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.GetRolesAsync(
            userId.Value,
            serverId,
            query,
            cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpPost("api/servers/{serverId:guid}/roles")]
    public async Task<ActionResult<ServerRoleResponse>> CreateRole(Guid serverId, [FromBody] CreateServerRoleRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._governanceService.CreateRoleAsync(
            userId.Value,
            serverId,
            request,
            cancellationToken);
        return result.Status switch
        {
            CreateServerRoleStatus.Success => this.Ok(result.Role),
            CreateServerRoleStatus.InvalidRequest => this.BadRequest(
                new { code = "invalid_role_create" }),
            CreateServerRoleStatus.Conflict => this.Conflict(
                new { code = "server_role_conflict" }),
            CreateServerRoleStatus.TitleConflict => this.Conflict(
                new { code = "server_role_title_conflict" }),
            _ => this.NotFound()
        };
    }

    [HttpPatch("api/servers/{serverId:guid}/roles/{roleId:guid}/permissions")]
    public async Task<ActionResult<ServerRoleResponse>> UpdateRolePermissions(Guid serverId, Guid roleId, [FromBody] UpdateServerRolePermissionsRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._governanceService.UpdateRolePermissionsAsync(
            userId.Value,
            serverId,
            roleId,
            request,
            cancellationToken);
        return this.ToUpdateRoleActionResult(result);
    }

    [HttpPatch("api/servers/{serverId:guid}/roles/{roleId:guid}")]
    public async Task<ActionResult<ServerRoleResponse>> UpdateRole(
        Guid serverId,
        Guid roleId,
        [FromBody] UpdateServerRoleRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._governanceService.UpdateRoleAsync(
            userId.Value,
            serverId,
            roleId,
            request,
            cancellationToken);
        return this.ToUpdateRoleActionResult(result);
    }

    [HttpPost("api/servers/{serverId:guid}/roles/{roleId:guid}/duplicate")]
    public async Task<ActionResult<ServerRoleResponse>> DuplicateRole(
        Guid serverId,
        Guid roleId,
        [FromBody] DuplicateServerRoleRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._governanceService.DuplicateRoleAsync(
            userId.Value,
            serverId,
            roleId,
            request,
            cancellationToken);
        return result.Status switch
        {
            DuplicateServerRoleStatus.Success => this.Ok(result.Role),
            DuplicateServerRoleStatus.InvalidRequest => this.BadRequest(
                new { code = "invalid_role_duplicate" }),
            DuplicateServerRoleStatus.Conflict => this.Conflict(
                new { code = "server_role_conflict" }),
            DuplicateServerRoleStatus.TitleConflict => this.Conflict(
                new { code = "server_role_title_conflict" }),
            DuplicateServerRoleStatus.AdministratorConfirmationRequired => this.Conflict(
                new { code = "server_role_administrator_confirmation_required" }),
            _ => this.NotFound()
        };
    }

    [HttpGet("api/servers/{serverId:guid}/roles/{roleId:guid}/deletion-impact")]
    public async Task<ActionResult<ServerRoleDeletionImpactResponse>> GetRoleDeletionImpact(
        Guid serverId,
        Guid roleId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var impact = await this._governanceService.GetRoleDeletionImpactAsync(
            userId.Value,
            serverId,
            roleId,
            cancellationToken);
        return impact == null ? this.NotFound() : this.Ok(impact);
    }

    [HttpDelete("api/servers/{serverId:guid}/roles/{roleId:guid}")]
    public async Task<IActionResult> DeleteRole(
        Guid serverId,
        Guid roleId,
        [FromQuery] Guid expectedVersion,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._governanceService.DeleteRoleAsync(
            userId.Value,
            serverId,
            roleId,
            expectedVersion,
            cancellationToken);
        return result.Status switch
        {
            DeleteServerRoleStatus.Success => this.NoContent(),
            DeleteServerRoleStatus.InvalidRequest => this.BadRequest(
                new { code = "invalid_role_delete" }),
            DeleteServerRoleStatus.Conflict => this.Conflict(
                new { code = "server_role_conflict" }),
            DeleteServerRoleStatus.HasDependencies => this.Conflict(new
            {
                code = "server_role_has_dependencies",
                impact = result.Impact
            }),
            _ => this.NotFound()
        };
    }

    [HttpPut("api/servers/{serverId:guid}/roles/order")]
    public async Task<IActionResult> ReorderRoles(
        Guid serverId,
        [FromBody] ReorderServerRolesRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var result = await this._governanceService.ReorderRolesAsync(
            userId.Value,
            serverId,
            request,
            cancellationToken);
        return result.Status switch
        {
            ReorderServerRolesStatus.Success => this.NoContent(),
            ReorderServerRolesStatus.InvalidRequest => this.BadRequest(
                new { code = "invalid_role_order" }),
            ReorderServerRolesStatus.Conflict => this.Conflict(
                new { code = "server_role_conflict" }),
            _ => this.NotFound()
        };
    }

    [HttpPost("api/servers/{serverId:guid}/members/{memberId:guid}/roles")]
    public async Task<ActionResult<ServerMemberRoleResponse>> AssignRole(Guid serverId, Guid memberId, [FromBody] AssignServerRoleRequest request, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.AssignRoleAsync(userId.Value, serverId, memberId, request, cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    [HttpDelete("api/servers/{serverId:guid}/member-roles/{memberRoleId:guid}")]
    public async Task<IActionResult> RevokeRole(Guid serverId, Guid memberRoleId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        return await this._governanceService.RevokeMemberRoleAsync(userId.Value, serverId, memberRoleId, cancellationToken)
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpGet("api/servers/{serverId:guid}/audit-logs")]
    public async Task<ActionResult<IReadOnlyList<ServerAuditLogResponse>>> GetAuditLogs(Guid serverId, CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var response = await this._governanceService.GetAuditLogsAsync(userId.Value, serverId, cancellationToken);
        return response == null ? this.NotFound() : this.Ok(response);
    }

    private Guid? GetCurrentUserId()
    {
        var userIdValue = this.User.FindFirstValue("userId");
        return Guid.TryParse(userIdValue, out var userId) ? userId : null;
    }

    private ActionResult<ServerRoleResponse> ToUpdateRoleActionResult(
        UpdateServerRoleResult result)
    {
        return result.Status switch
        {
            UpdateServerRoleStatus.Success => this.Ok(result.Role),
            UpdateServerRoleStatus.InvalidRequest => this.BadRequest(
                new { code = "invalid_role_update" }),
            UpdateServerRoleStatus.Conflict => this.Conflict(
                new { code = "server_role_conflict" }),
            UpdateServerRoleStatus.TitleConflict => this.Conflict(
                new { code = "server_role_title_conflict" }),
            _ => this.NotFound()
        };
    }
}
