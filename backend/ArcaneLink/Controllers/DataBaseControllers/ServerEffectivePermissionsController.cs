using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
[Route("api/servers/{serverId:guid}/members/me/effective-permissions")]
public sealed class ServerEffectivePermissionsController : ControllerBase
{
    private readonly IServerAuthorizationRuntime _authorization;

    public ServerEffectivePermissionsController(
        IServerAuthorizationRuntime authorization)
    {
        this._authorization = authorization;
    }

    [HttpGet]
    public async Task<ActionResult<ServerEffectivePermissionsResponse>> Get(
        Guid serverId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null) return this.Unauthorized();
        var context = await this._authorization.GetContextAsync(
            userId.Value,
            serverId,
            cancellationToken);
        if (context == null ||
            !ServerAuthorizationEvaluator.TryResolvePrincipal(
                context.Principal,
                out var authority,
                out var isAdministrator))
        {
            return this.NotFound();
        }

        var permissionCodes = ServerPermissionRegistry.All
            .Where(permission => ServerAuthorizationEvaluator.IsAllowed(
                context.Principal,
                new ServerAuthorizationRequest(
                    serverId,
                    permission.Code,
                    OwnerOnly: false,
                    DependencyCodes: [])))
            .Select(permission => permission.Code)
            .ToList();
        return this.Ok(new ServerEffectivePermissionsResponse
        {
            ServerId = serverId,
            MemberId = context.Principal.MemberId,
            AuthorizationVersion = context.AuthorizationVersion,
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            IsOwner = context.Principal.IsOwner,
            IsAdministrator = isAdministrator,
            AuthorityTier = authority.Tier.ToString().ToLowerInvariant(),
            AuthorityPosition = authority.Tier is
                ServerRoleAuthorityTier.Standard or
                ServerRoleAuthorityTier.Administrator
                    ? authority.Position
                    : null,
            PermissionCodes = permissionCodes
        });
    }

    private Guid? GetCurrentUserId()
    {
        var userIdValue = this.User.FindFirstValue("userId");
        return Guid.TryParse(userIdValue, out var userId) ? userId : null;
    }
}
