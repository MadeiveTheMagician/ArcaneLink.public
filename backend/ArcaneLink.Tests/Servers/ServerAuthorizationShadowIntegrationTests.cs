using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerAuthorizationShadowIntegrationTests
{
    [Fact]
    public async Task EnabledShadow_ObservesV1DecisionWithoutChangingLegacyResult()
    {
        var runtime = new RecordingAuthorizationRuntime(shadowAllowed: false);
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.Configure<ServerAuthorizationShadowOptions>(options =>
                options.Enabled = true);
            services.RemoveAll<IServerAuthorizationRuntime>();
            services.AddSingleton<IServerAuthorizationRuntime>(runtime);
        });
        _ = factory.Services;

        using var scope = factory.Services.CreateScope();
        var access = scope.ServiceProvider
            .GetRequiredService<IServerGovernanceAccessService>();

        var allowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);

        Assert.True(allowed);
        Assert.Equal(1, runtime.EvaluationCount);
        Assert.Equal("VIEW_AUDIT_LOG", runtime.LastRequirement?.PermissionCode);
    }

    [Fact]
    public async Task DisabledShadow_DoesNotEvaluateV1Runtime()
    {
        var runtime = new RecordingAuthorizationRuntime(shadowAllowed: false);
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IServerAuthorizationRuntime>();
            services.AddSingleton<IServerAuthorizationRuntime>(runtime);
        });
        _ = factory.Services;

        using var scope = factory.Services.CreateScope();
        var access = scope.ServiceProvider
            .GetRequiredService<IServerGovernanceAccessService>();

        var allowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);

        Assert.True(allowed);
        Assert.Equal(0, runtime.EvaluationCount);

        var denied = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);

        Assert.False(denied);
        Assert.Equal(0, runtime.EvaluationCount);
    }

    [Fact]
    public async Task EnforcedCanary_UsesV1DecisionWhileOtherPermissionsStayLegacy()
    {
        var runtime = new RecordingAuthorizationRuntime(shadowAllowed: false);
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.Configure<ServerAuthorizationShadowOptions>(options =>
                options.EnforcedPermissionCodes = ["VIEW_AUDIT_LOG"]);
            services.RemoveAll<IServerAuthorizationRuntime>();
            services.AddSingleton<IServerAuthorizationRuntime>(runtime);
        });
        _ = factory.Services;

        using var scope = factory.Services.CreateScope();
        var access = scope.ServiceProvider
            .GetRequiredService<IServerGovernanceAccessService>();

        var auditAllowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);
        var rolesAllowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionManageRoles,
            CancellationToken.None);

        Assert.False(auditAllowed);
        Assert.True(rolesAllowed);
        Assert.Equal(1, runtime.EvaluationCount);
        Assert.Equal("VIEW_AUDIT_LOG", runtime.LastRequirement?.PermissionCode);
    }

    [Fact]
    public async Task EnforcedCanary_FailsClosedWhenV1RuntimeFails()
    {
        var runtime = new RecordingAuthorizationRuntime(
            shadowAllowed: true,
            evaluationException: new InvalidOperationException("runtime failed"));
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.Configure<ServerAuthorizationShadowOptions>(options =>
                options.EnforcedPermissionCodes = ["VIEW_AUDIT_LOG"]);
            services.RemoveAll<IServerAuthorizationRuntime>();
            services.AddSingleton<IServerAuthorizationRuntime>(runtime);
        });
        _ = factory.Services;

        using var scope = factory.Services.CreateScope();
        var access = scope.ServiceProvider
            .GetRequiredService<IServerGovernanceAccessService>();

        var allowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);

        Assert.False(allowed);
        Assert.Equal(1, runtime.EvaluationCount);
    }

    [Fact]
    public async Task EnforcedCanary_UsesV1AllowOverLegacyDeny()
    {
        var runtime = new RecordingAuthorizationRuntime(shadowAllowed: true);
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.Configure<ServerAuthorizationShadowOptions>(options =>
                options.EnforcedPermissionCodes = ["VIEW_AUDIT_LOG"]);
            services.RemoveAll<IServerAuthorizationRuntime>();
            services.AddSingleton<IServerAuthorizationRuntime>(runtime);
        });
        _ = factory.Services;

        using var scope = factory.Services.CreateScope();
        var access = scope.ServiceProvider
            .GetRequiredService<IServerGovernanceAccessService>();

        var allowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);

        Assert.True(allowed);
        Assert.Equal(1, runtime.EvaluationCount);
    }

    [Fact]
    public async Task EnforcedCanary_FailsClosedWhenV1RuntimeIsUnavailable()
    {
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.Configure<ServerAuthorizationShadowOptions>(options =>
                options.EnforcedPermissionCodes = ["VIEW_AUDIT_LOG"]);
            services.RemoveAll<IServerAuthorizationRuntime>();
        });
        _ = factory.Services;

        using var scope = factory.Services.CreateScope();
        var access = scope.ServiceProvider
            .GetRequiredService<IServerGovernanceAccessService>();

        var allowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);

        Assert.False(allowed);
    }

    [Fact]
    public async Task ShadowOnly_RuntimeFailurePreservesLegacyDecision()
    {
        var runtime = new RecordingAuthorizationRuntime(
            shadowAllowed: false,
            evaluationException: new InvalidOperationException("runtime failed"));
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.Configure<ServerAuthorizationShadowOptions>(options =>
                options.Enabled = true);
            services.RemoveAll<IServerAuthorizationRuntime>();
            services.AddSingleton<IServerAuthorizationRuntime>(runtime);
        });
        _ = factory.Services;

        using var scope = factory.Services.CreateScope();
        var access = scope.ServiceProvider
            .GetRequiredService<IServerGovernanceAccessService>();

        var allowed = await access.HasEffectiveServerPermissionAsync(
            ArcaneLinkApiFactory.OwnerUserId,
            ArcaneLinkApiFactory.ServerId,
            ServerGovernanceIds.PermissionViewAuditLog,
            CancellationToken.None);

        Assert.True(allowed);
        Assert.Equal(1, runtime.EvaluationCount);
    }

    private sealed class RecordingAuthorizationRuntime(
        bool shadowAllowed,
        Exception? evaluationException = null)
        : IServerAuthorizationRuntime
    {
        public int EvaluationCount { get; private set; }
        public ServerAuthorizationRequirement? LastRequirement { get; private set; }

        public Task<ServerAuthorizationContext?> GetContextAsync(
            Guid userId,
            Guid serverId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<ServerAuthorizationContext?>(null);
        }

        public Task<bool> IsAllowedAsync(
            Guid userId,
            Guid serverId,
            ServerAuthorizationRequirement requirement,
            CancellationToken cancellationToken = default)
        {
            EvaluationCount++;
            LastRequirement = requirement;
            if (evaluationException != null)
            {
                throw evaluationException;
            }

            return Task.FromResult(shadowAllowed);
        }
    }
}
