using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Spaces;

public sealed class GranularSpaceAuthorizationIntegrationTests
{
    [Fact]
    public async Task ExactRolePermission_IsScopedAndLegacyDenyRemainsAuthoritative()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        await AssignExactRoleAsync(
            factory,
            ServerPermissionRegistry.CreateMask(["MANAGE_SPACE_SETTINGS"]));

        using (var scope = factory.Services.CreateScope())
        {
            var authorization = scope.ServiceProvider
                .GetRequiredService<ISpaceAuthorizationService>();

            Assert.True(await authorization.IsAllowedAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                ArcaneLinkApiFactory.TextSpaceId,
                new SpaceAuthorizationRequirement("MANAGE_SPACE_SETTINGS")));
            Assert.False(await authorization.IsAllowedAsync(
                ArcaneLinkApiFactory.MemberUserId,
                ArcaneLinkApiFactory.ServerId,
                ArcaneLinkApiFactory.TextSpaceId,
                new SpaceAuthorizationRequirement("MANAGE_SPACE_ACCESS")));
        }

        using (var client = factory.CreateClient())
        {
            client.AuthorizeWith(await client.LoginAsync("member"));
            var spaces = await client.GetFromJsonAsync<List<SpaceResponse>>(
                $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces");
            var space = Assert.Single(spaces!);
            Assert.True(space.EffectiveCapabilities.CanManageSpace);
            Assert.False(space.EffectiveCapabilities.CanManageSpaceAccess);
            Assert.Empty(space.PermissionOverrides);
        }

        await AddLegacyManageDenyAsync(factory);

        using var deniedScope = factory.Services.CreateScope();
        var refreshedAuthorization = deniedScope.ServiceProvider
            .GetRequiredService<ISpaceAuthorizationService>();
        Assert.False(await refreshedAuthorization.IsAllowedAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            new SpaceAuthorizationRequirement("MANAGE_SPACE_SETTINGS")));
    }

    [Fact]
    public async Task AllowOverride_CannotGrantBeyondActorEffectiveMask()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        await AssignExactRoleAsync(
            factory,
            ServerPermissionRegistry.CreateMask(["MANAGE_SPACE_ACCESS"]));
        var targetRoleId = await CreateRoleAsync(factory, level: 20);

        using var scope = factory.Services.CreateScope();
        var overrides = scope.ServiceProvider
            .GetRequiredService<ISpacePermissionOverrideService>();

        var result = await overrides.UpsertPermissionOverrideAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            new UpsertSpacePermissionOverrideRequest
            {
                RoleId = targetRoleId,
                PermissionId = SpacePermissionIds.ManageSpace,
                Allow = true
            });

        Assert.Null(result);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.SpacePermissionOverrides.AnyAsync(candidate =>
            candidate.SpaceId == ArcaneLinkApiFactory.TextSpaceId &&
            candidate.RoleId == targetRoleId &&
            candidate.PermissionId == SpacePermissionIds.ManageSpace));
    }

    [Fact]
    public async Task OverrideTarget_MustBeStrictlyBelowActorAuthority()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var manageMask = new LegacySpacePermissionMaskAdapter();
        Assert.True(manageMask.TryCreateMask(
            SpacePermissionIds.ManageSpace,
            out var exactManageMask));
        await AssignExactRoleAsync(factory, exactManageMask);
        var strongerRoleId = await CreateRoleAsync(factory, level: 5);

        using var scope = factory.Services.CreateScope();
        var overrides = scope.ServiceProvider
            .GetRequiredService<ISpacePermissionOverrideService>();

        var selfGrant = await overrides.UpsertPermissionOverrideAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.ManageSpace,
                Allow = true
            });
        var aboveAuthorityGrant = await overrides.UpsertPermissionOverrideAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            new UpsertSpacePermissionOverrideRequest
            {
                RoleId = strongerRoleId,
                PermissionId = SpacePermissionIds.ManageSpace,
                Allow = true
            });

        Assert.Null(selfGrant);
        Assert.Null(aboveAuthorityGrant);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.SpacePermissionOverrides.AnyAsync(candidate =>
            candidate.SpaceId == ArcaneLinkApiFactory.TextSpaceId &&
            candidate.PermissionId == SpacePermissionIds.ManageSpace &&
            (candidate.MemberId == ArcaneLinkApiFactory.MemberMemberId ||
             candidate.RoleId == strongerRoleId)));
    }

    [Fact]
    public async Task DelegatedAllow_WithinActorMask_StoresActorProtectionRole()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        var adapter = new LegacySpacePermissionMaskAdapter();
        Assert.True(adapter.TryCreateMask(
            SpacePermissionIds.ManageSpace,
            out var exactManageMask));
        var actorRoleId = await AssignExactRoleAsync(factory, exactManageMask);
        var targetRoleId = await CreateRoleAsync(factory, level: 20);

        using var scope = factory.Services.CreateScope();
        var overrides = scope.ServiceProvider
            .GetRequiredService<ISpacePermissionOverrideService>();

        var result = await overrides.UpsertPermissionOverrideAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            new UpsertSpacePermissionOverrideRequest
            {
                RoleId = targetRoleId,
                PermissionId = SpacePermissionIds.ManageSpace,
                Allow = true
            });

        Assert.NotNull(result);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.SpacePermissionOverrides.SingleAsync(candidate =>
            candidate.Id == result.Id);
        Assert.Equal(ArcaneLinkApiFactory.MemberUserId, stored.CreatedByUserId);
        Assert.Equal(actorRoleId, stored.ProtectionRoleId);
    }

    [Fact]
    public async Task OwnerProtectionRole_WinsBeforeAssignedRoles()
    {
        using var factory = new ArcaneLinkApiFactory();
        _ = factory.Services;
        Guid ownerRoleId;
        using (var seedScope = factory.Services.CreateScope())
        {
            var seedDb = seedScope.ServiceProvider
                .GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var ownerRole = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Code = "owner",
                Title = "Owner",
                Kind = ServerRoleKindCodes.Standard,
                Level = 10,
                PermissionMask = ServerPermissionRegistry.CreateMask(
                    [ServerPermissionRegistry.AdministratorCode]).ToByteArray(),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            };
            var distractingRole = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Title = "Assigned before owner tier",
                Kind = ServerRoleKindCodes.Standard,
                Level = 0,
                PermissionMask = PermissionMask256.Empty.ToByteArray(),
                PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
                CreatedAt = now,
                UpdatedAt = now
            };
            ownerRoleId = ownerRole.Id;
            seedDb.ServerRoles.AddRange(ownerRole, distractingRole);
            seedDb.ServerMemberRoles.Add(new ServerMemberRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                MemberId = ArcaneLinkApiFactory.OwnerMemberId,
                RoleId = distractingRole.Id,
                AssignedAt = now
            });
            var server = await seedDb.Servers.SingleAsync(candidate =>
                candidate.Id == ArcaneLinkApiFactory.ServerId);
            server.AuthorizationVersion = Guid.NewGuid();
            await seedDb.SaveChangesAsync();
        }

        using var scope = factory.Services.CreateScope();
        var overrides = scope.ServiceProvider
            .GetRequiredService<ISpacePermissionOverrideService>();
        var result = await overrides.UpsertPermissionOverrideAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ArcaneLinkApiFactory.TextSpaceId,
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = SpacePermissionIds.ViewSpace,
                Allow = true
            });

        Assert.NotNull(result);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.SpacePermissionOverrides.SingleAsync(candidate =>
            candidate.Id == result.Id);
        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, stored.CreatedByUserId);
        Assert.Equal(ownerRoleId, stored.ProtectionRoleId);
    }

    private static async Task<Guid> AssignExactRoleAsync(
        ArcaneLinkApiFactory factory,
        PermissionMask256 permissionMask)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var roleId = Guid.NewGuid();
        db.ServerRoles.Add(new ServerRole
        {
            Id = roleId,
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = "Granular space editor",
            Kind = ServerRoleKindCodes.Standard,
            Level = 10,
            PermissionMask = permissionMask.ToByteArray(),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = ArcaneLinkApiFactory.MemberMemberId,
            RoleId = roleId,
            AssignedAt = now
        });
        db.SpacePermissionOverrides.Add(new SpacePermissionOverride
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            SpaceId = ArcaneLinkApiFactory.TextSpaceId,
            MemberId = ArcaneLinkApiFactory.OwnerMemberId,
            PermissionId = SpacePermissionIds.ViewSpace,
            Allow = true,
            Deny = false,
            CreatedAt = now
        });
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AuthorizationVersion = Guid.NewGuid();
        await db.SaveChangesAsync();
        return roleId;
    }

    private static async Task<Guid> CreateRoleAsync(
        ArcaneLinkApiFactory factory,
        int level)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var role = new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = $"ACL target {level}",
            Kind = ServerRoleKindCodes.Standard,
            Level = level,
            PermissionMask = PermissionMask256.Empty.ToByteArray(),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ServerRoles.Add(role);
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.AuthorizationVersion = Guid.NewGuid();
        await db.SaveChangesAsync();
        return role.Id;
    }

    private static async Task AddLegacyManageDenyAsync(
        ArcaneLinkApiFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SpacePermissionOverrides.Add(new SpacePermissionOverride
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            SpaceId = ArcaneLinkApiFactory.TextSpaceId,
            MemberId = ArcaneLinkApiFactory.MemberMemberId,
            PermissionId = SpacePermissionIds.ManageSpace,
            Allow = false,
            Deny = true,
            CreatedAt = DateTime.UtcNow
        });
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        server.SpaceAclRevision = Guid.NewGuid();
        server.AuthorizationVersion = Guid.NewGuid();
        await db.SaveChangesAsync();
    }
}
