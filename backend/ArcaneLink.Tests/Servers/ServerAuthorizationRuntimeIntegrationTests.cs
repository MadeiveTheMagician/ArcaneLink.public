using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerAuthorizationRuntimeIntegrationTests
{
    [Fact]
    public async Task Runtime_DistinguishesActiveOwnerOrdinaryInactiveAndAdministrator()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;

        using (var ordinaryScope = factory.Services.CreateScope())
        {
            var ordinaryRuntime = ordinaryScope.ServiceProvider
                .GetRequiredService<IServerAuthorizationRuntime>();
            var ordinary = await ordinaryRuntime.GetContextAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId);

            Assert.NotNull(ordinary);
            Assert.False(ordinary.Principal.IsOwner);
            Assert.False(await ordinaryRuntime.IsAllowedAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                new ServerAuthorizationRequirement("VIEW_AUDIT_LOG")));
        }

        await AddRoleAsync(
            factory,
            ArcaneLinkApiFactory.MemberMemberId,
            ServerGovernanceIds.PermissionManageServer);

        using var scope = factory.Services.CreateScope();
        var runtime = scope.ServiceProvider
            .GetRequiredService<IServerAuthorizationRuntime>();

        var owner = await runtime.GetContextAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId);
        var administrator = await runtime.GetContextAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId);
        var inactive = await runtime.GetContextAsync(
            ArcaneLinkApiFactory.OutsiderUserId,
            ArcaneLinkApiFactory.ServerId);

        Assert.NotNull(owner);
        Assert.True(owner.Principal.IsOwner);
        Assert.NotNull(administrator);
        Assert.False(administrator.Principal.IsOwner);
        Assert.Null(inactive);
        Assert.True(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("MANAGE_REPORTS")));
        Assert.True(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("VIEW_AUDIT_LOG")));
        Assert.False(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.OutsiderUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("VIEW_AUDIT_LOG")));
    }

    [Fact]
    public async Task CacheHitReusesContext_AndRevisionChangeLoadsANewDecision()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var roleId = await AddRoleAsync(
            factory,
            ArcaneLinkApiFactory.MemberMemberId,
            ServerGovernanceIds.PermissionViewAuditLog);

        using var scope = factory.Services.CreateScope();
        var runtime = scope.ServiceProvider
            .GetRequiredService<IServerAuthorizationRuntime>();
        var first = await runtime.GetContextAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId);
        var cached = await runtime.GetContextAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId);

        Assert.NotNull(first);
        Assert.Same(first, cached);
        Assert.True(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("VIEW_AUDIT_LOG")));

        await RemoveRolePermissionAndBumpRevisionAsync(factory, roleId);

        var refreshed = await runtime.GetContextAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId);

        Assert.NotNull(refreshed);
        Assert.NotSame(first, refreshed);
        Assert.NotEqual(first.AuthorizationVersion, refreshed.AuthorizationVersion);
        Assert.False(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("VIEW_AUDIT_LOG")));
    }

    [Fact]
    public async Task UnknownGrantedLegacyRow_FailsTheContextClosed()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var unknownPermissionId = Guid.NewGuid();

        using (var seedScope = factory.Services.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.PermissionCatalog.Add(new PermissionCatalog
            {
                Id = unknownPermissionId,
                Code = "future_unknown_permission",
                Title = "Future unknown permission",
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        await AddRoleAsync(
            factory,
            ArcaneLinkApiFactory.MemberMemberId,
            unknownPermissionId);

        using var scope = factory.Services.CreateScope();
        var runtime = scope.ServiceProvider
            .GetRequiredService<IServerAuthorizationRuntime>();

        Assert.Null(await runtime.GetContextAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId));
        Assert.False(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("VIEW_AUDIT_LOG")));
    }

    [Fact]
    public async Task PersistedMask_TakesPrecedenceOverLegacyCompatibilityRows()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        await AddRoleAsync(
            factory,
            ArcaneLinkApiFactory.MemberMemberId,
            ServerGovernanceIds.PermissionViewAuditLog,
            ServerPermissionRegistry.CreateMask(["SEND_MESSAGES"]));

        using var scope = factory.Services.CreateScope();
        var runtime = scope.ServiceProvider
            .GetRequiredService<IServerAuthorizationRuntime>();

        Assert.True(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("SEND_MESSAGES")));
        Assert.False(await runtime.IsAllowedAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            new ServerAuthorizationRequirement("VIEW_AUDIT_LOG")));
    }

    private static async Task<Guid> AddRoleAsync(
        ArcaneLinkApiFactory factory,
        Guid memberId,
        Guid permissionId,
        PermissionMask256? persistedMask = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var roleId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var role = new ServerRole
        {
            Id = roleId,
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = $"Runtime {roleId:N}",
            Kind = ServerRoleKindCodes.Standard,
            Level = 10,
            PermissionMask = (persistedMask ?? PermissionMask256.Empty)
                .ToByteArray(),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = now,
            UpdatedAt = now
        };
        role.Permissions.Add(new ServerRolePermission
        {
            RoleId = roleId,
            PermissionId = permissionId,
            IsGranted = true,
            CreatedAt = now
        });
        db.ServerRoles.Add(role);
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = memberId,
            RoleId = roleId,
            AssignedAt = now
        });
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AuthorizationVersion = Guid.NewGuid();
        await db.SaveChangesAsync();
        return roleId;
    }

    private static async Task RemoveRolePermissionAndBumpRevisionAsync(
        ArcaneLinkApiFactory factory,
        Guid roleId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var grants = await db.ServerRolePermissions
            .Where(permission => permission.RoleId == roleId)
            .ToListAsync();
        db.ServerRolePermissions.RemoveRange(grants);
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AuthorizationVersion = Guid.NewGuid();
        await db.SaveChangesAsync();
    }
}
