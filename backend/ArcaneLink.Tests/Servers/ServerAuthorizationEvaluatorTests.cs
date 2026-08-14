using ArcaneLink.Services.Servers.Authorization;

namespace ArcaneLink.Tests.Servers;

public sealed class ServerAuthorizationEvaluatorTests
{
    private static readonly Guid ServerId =
        Guid.Parse("22000000-0000-0000-0000-000000000001");
    private static readonly Guid MemberId =
        Guid.Parse("22000000-0000-0000-0000-000000000002");
    private static readonly Guid EveryoneRoleId =
        Guid.Parse("22000000-0000-0000-0000-000000000003");
    private static readonly Guid StandardRoleId =
        Guid.Parse("22000000-0000-0000-0000-000000000004");

    [Fact]
    public void InactiveCrossServerAndUnknownInputs_FailClosed()
    {
        var request = Request("VIEW_TEXT_SPACES");
        var inactiveOwner = Principal(
            isActive: false,
            isOwner: true,
            everyonePermissions: ["VIEW_TEXT_SPACES"]);
        var crossServerRole = Role(
            ServerAuthorizationRoleKind.Standard,
            10,
            ["VIEW_TEXT_SPACES"],
            serverId: Guid.NewGuid());
        var unknownMaskOwner = Principal(isOwner: true) with
        {
            EveryoneRole = Role(
                ServerAuthorizationRoleKind.Everyone,
                int.MaxValue,
                mask: PermissionMask256.Empty.With(51),
                id: EveryoneRoleId)
        };
        var missingMember = Principal(isOwner: true) with
        {
            MemberId = Guid.Empty
        };

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(inactiveOwner, request));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            Principal(assignedRoles: [crossServerRole]),
            request));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(unknownMaskOwner, request));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(missingMember, request));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            Principal(isOwner: true),
            Request("UNKNOWN_PERMISSION")));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            Principal(everyonePermissions: ["VIEW_TEXT_SPACES"]),
            Request("VIEW_TEXT_SPACES", dependencies: ["UNKNOWN_PERMISSION"])));
    }

    [Fact]
    public void OwnerOnlyGuard_RunsBeforeAdministratorBypass()
    {
        var administrator = Principal(
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Standard,
                    10,
                    ["ADMINISTRATOR"])
            ]);

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            administrator,
            Request("MANAGE_SERVER_SETTINGS", ownerOnly: true)));
        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            Principal(isOwner: true),
            Request("MANAGE_SERVER_SETTINGS", ownerOnly: true)));
        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            administrator,
            Request("MANAGE_SERVER_SETTINGS")));
    }

    [Fact]
    public void AdministratorRequiresAnAssignedStandardRole_AndBypassesAcl()
    {
        var denyAllResource = Resource(
            space: Scope(
                RoleOverride(
                    EveryoneRoleId,
                    deny: Mask("VIEW_AUDIT_LOG"))));
        var everyoneWithAdministrator = Principal(
            everyonePermissions: ["ADMINISTRATOR"]);
        var integrationWithAdministrator = Principal(
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Integration,
                    1,
                    ["ADMINISTRATOR"])
            ]);
        var assignedStandardAdministrator = Principal(
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Standard,
                    50,
                    ["ADMINISTRATOR"])
            ]);
        var request = Request(
            "VIEW_AUDIT_LOG",
            permissionResource: denyAllResource);

        Assert.False(ServerAuthorizationEvaluator.TryResolvePrincipal(
            everyoneWithAdministrator,
            out _,
            out _));
        Assert.False(ServerAuthorizationEvaluator.TryResolvePrincipal(
            integrationWithAdministrator,
            out _,
            out _));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            everyoneWithAdministrator,
            request));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            integrationWithAdministrator,
            request));
        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            assignedStandardAdministrator,
            request));
    }

    [Fact]
    public void AdministratorCannotBeGrantedOrDeniedByAclOverrides()
    {
        var allowAdministrator = Resource(
            space: Scope(
                MemberOverride(allow: Mask("ADMINISTRATOR"))));
        var denyAdministrator = Resource(
            space: Scope(
                MemberOverride(deny: Mask("ADMINISTRATOR"))));

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            Principal(),
            Request(
                "ADMINISTRATOR",
                permissionResource: allowAdministrator)));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            Principal(isOwner: true),
            Request(
                "VIEW_AUDIT_LOG",
                permissionResource: denyAdministrator)));
    }

    [Fact]
    public void EveryoneAndAssignedRolePermissions_AreCombinedWithOr()
    {
        var principal = Principal(
            everyonePermissions: ["VIEW_TEXT_SPACES"],
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Standard,
                    10,
                    ["SEND_MESSAGES"])
            ]);

        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("VIEW_TEXT_SPACES")));
        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("SEND_MESSAGES")));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("MANAGE_MESSAGES")));
    }

    [Fact]
    public void OverridesApplyRoleRootToLeafThenSpace_ThenMemberRootToLeafThenSpace()
    {
        var role = Role(
            ServerAuthorizationRoleKind.Standard,
            10,
            [],
            id: StandardRoleId);
        var root = Scope(
            RoleOverride(StandardRoleId, deny: Mask("SEND_MESSAGES")),
            MemberOverride(allow: Mask("SEND_LINKS", "ATTACH_FILES")));
        var leaf = Scope(
            RoleOverride(StandardRoleId, allow: Mask("SEND_MESSAGES")),
            MemberOverride(deny: Mask("ATTACH_FILES")));
        var space = Scope(
            RoleOverride(StandardRoleId, deny: Mask("SEND_LINKS")),
            MemberOverride(
                allow: Mask("ADD_REACTIONS"),
                deny: Mask("ADD_REACTIONS")));
        var resource = Resource([root, leaf], space);
        var principal = Principal(assignedRoles: [role]);

        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("SEND_MESSAGES", permissionResource: resource)));
        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("SEND_LINKS", permissionResource: resource)));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("ATTACH_FILES", permissionResource: resource)));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("ADD_REACTIONS", permissionResource: resource)));
    }

    [Fact]
    public void HigherProtectionAuthority_WinsOverLowerMemberSpecificity()
    {
        var principal = Principal(
            everyonePermissions: ["SEND_MESSAGES"],
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Standard,
                    20,
                    [],
                    id: StandardRoleId)
            ]);
        var resource = Resource(
            space: Scope(
                RoleOverride(
                    StandardRoleId,
                    deny: Mask("SEND_MESSAGES"),
                    protectionAuthority:
                        ServerRoleAuthority.Standard(ServerId, 10)),
                MemberOverride(
                    allow: Mask("SEND_MESSAGES"),
                    protectionAuthority:
                        ServerRoleAuthority.Standard(ServerId, 50))));

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("SEND_MESSAGES", permissionResource: resource)));
    }

    [Fact]
    public void HigherProtectionAuthority_CanReplaceLowerRolePolicy()
    {
        var principal = Principal(
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Standard,
                    20,
                    [],
                    id: StandardRoleId)
            ]);
        var resource = Resource(
            space: Scope(
                RoleOverride(
                    StandardRoleId,
                    deny: Mask("SEND_MESSAGES"),
                    protectionAuthority:
                        ServerRoleAuthority.Standard(ServerId, 50)),
                MemberOverride(
                    allow: Mask("SEND_MESSAGES"),
                    protectionAuthority:
                        ServerRoleAuthority.Standard(ServerId, 10))));

        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("SEND_MESSAGES", permissionResource: resource)));
    }

    [Fact]
    public void LegacyNullProtection_IsOwnerTierAgainstNewLowerOverride()
    {
        var principal = Principal(
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Standard,
                    20,
                    [],
                    id: StandardRoleId)
            ]);
        var resource = Resource(
            space: Scope(
                RoleOverride(
                    StandardRoleId,
                    deny: Mask("SEND_MESSAGES")),
                MemberOverride(
                    allow: Mask("SEND_MESSAGES"),
                    protectionAuthority:
                        ServerRoleAuthority.Administrator(ServerId, 1))));

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("SEND_MESSAGES", permissionResource: resource)));
    }

    [Fact]
    public void DependenciesAreCheckedAfterAcl()
    {
        var resource = Resource(
            space: Scope(
                MemberOverride(deny: Mask("SEND_MESSAGES"))));
        var principal = Principal(
            everyonePermissions: ["SEND_MESSAGES", "SEND_LINKS"]);

        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request("SEND_LINKS", permissionResource: resource)));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            principal,
            Request(
                "SEND_LINKS",
                dependencies: ["SEND_MESSAGES"],
                permissionResource: resource)));
    }

    [Fact]
    public void CrossServerAclAndTargetData_FailClosedBeforeBypass()
    {
        var otherServerId = Guid.NewGuid();
        var crossServerResource = new ServerPermissionResource(
            otherServerId,
            [],
            null);
        var crossServerTarget = new ServerAuthorizationSubjectTarget(
            Principal(serverId: otherServerId));
        var owner = Principal(isOwner: true);

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            owner,
            Request(
                "VIEW_AUDIT_LOG",
                permissionResource: crossServerResource)));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            owner,
            Request("VIEW_AUDIT_LOG", target: crossServerTarget)));
    }

    [Fact]
    public void UnknownOrCrossServerOverrideData_FailsClosedBeforeOwnerBypass()
    {
        var unknownMaskOverride = new ServerPermissionOverride(
            ServerId,
            ServerId,
            ServerPermissionOverrideTargetKind.Role,
            EveryoneRoleId,
            PermissionMask256.Empty.With(51),
            PermissionMask256.Empty);
        var crossServerOverride = new ServerPermissionOverride(
            ServerId,
            Guid.NewGuid(),
            ServerPermissionOverrideTargetKind.Role,
            EveryoneRoleId,
            PermissionMask256.Empty,
            PermissionMask256.Empty);
        var owner = Principal(isOwner: true);

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            owner,
            Request(
                "VIEW_AUDIT_LOG",
                permissionResource: Resource(
                    space: Scope(unknownMaskOverride)))));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            owner,
            Request(
                "VIEW_AUDIT_LOG",
                permissionResource: Resource(
                    space: Scope(crossServerOverride)))));
    }

    [Fact]
    public void DuplicateCategoryOrSpaceScopeIds_FailClosedBeforeBypass()
    {
        var repeatedScope = Scope();
        var duplicateCategory = Resource([repeatedScope, repeatedScope]);
        var duplicateSpace = Resource([repeatedScope], repeatedScope);
        var owner = Principal(isOwner: true);

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            owner,
            Request(
                "VIEW_AUDIT_LOG",
                permissionResource: duplicateCategory)));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            owner,
            Request(
                "VIEW_AUDIT_LOG",
                permissionResource: duplicateSpace)));
    }

    [Fact]
    public void ResourceHierarchyUsesGreaterOrEqual_AndSubjectHierarchyUsesStrictGreater()
    {
        var actorRole = Role(
            ServerAuthorizationRoleKind.Standard,
            10,
            ["MANAGE_SPACE_SETTINGS"],
            id: StandardRoleId);
        var actor = Principal(assignedRoles: [actorRole]);
        var sameProtection = new ServerAuthorizationResourceTarget(actorRole);
        var sameSubject = new ServerAuthorizationSubjectTarget(
            Principal(assignedRoles: [actorRole]));
        var everyoneSubject = new ServerAuthorizationSubjectTarget(Principal());

        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            actor,
            Request("MANAGE_SPACE_SETTINGS", target: sameProtection)));
        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            actor,
            Request("MANAGE_SPACE_SETTINGS", target: sameSubject)));
        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            actor,
            Request("MANAGE_SPACE_SETTINGS", target: everyoneSubject)));
    }

    [Fact]
    public void TargetOwnerIsProtectedEvenFromOwnerBypass()
    {
        var owner = Principal(isOwner: true);
        var ownerSubject = new ServerAuthorizationSubjectTarget(
            Principal(isOwner: true));

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            owner,
            Request("BAN_MEMBERS", target: ownerSubject)));
    }

    [Fact]
    public void AdministratorBypass_DoesNotBypassAdministrativeHierarchy()
    {
        var actor = Principal(
            assignedRoles:
            [
                Role(
                    ServerAuthorizationRoleKind.Standard,
                    20,
                    ["ADMINISTRATOR"])
            ]);
        var strongerAdministrator = new ServerAuthorizationSubjectTarget(
            Principal(
                assignedRoles:
                [
                    Role(
                        ServerAuthorizationRoleKind.Standard,
                        10,
                        ["ADMINISTRATOR"])
                ]));
        var standardSubject = new ServerAuthorizationSubjectTarget(
            Principal(
                assignedRoles:
                [
                    Role(
                        ServerAuthorizationRoleKind.Standard,
                        1,
                        [])
                ]));

        Assert.False(ServerAuthorizationEvaluator.IsAllowed(
            actor,
            Request("BAN_MEMBERS", target: strongerAdministrator)));
        Assert.True(ServerAuthorizationEvaluator.IsAllowed(
            actor,
            Request("BAN_MEMBERS", target: standardSubject)));
    }

    private static ServerAuthorizationPrincipal Principal(
        bool isActive = true,
        bool isOwner = false,
        IReadOnlyList<string>? everyonePermissions = null,
        IReadOnlyList<ServerAuthorizationRole>? assignedRoles = null,
        Guid? serverId = null)
    {
        var resolvedServerId = serverId ?? ServerId;
        return new ServerAuthorizationPrincipal(
            resolvedServerId,
            MemberId,
            isActive,
            isOwner,
            Role(
                ServerAuthorizationRoleKind.Everyone,
                int.MaxValue,
                everyonePermissions ?? [],
                EveryoneRoleId,
                resolvedServerId),
            assignedRoles ?? []);
    }

    private static ServerAuthorizationRole Role(
        ServerAuthorizationRoleKind kind,
        int position,
        IReadOnlyList<string>? permissions = null,
        Guid? id = null,
        Guid? serverId = null,
        PermissionMask256? mask = null)
    {
        return new ServerAuthorizationRole(
            id ?? Guid.NewGuid(),
            serverId ?? ServerId,
            kind,
            position,
            mask ?? Mask(permissions?.ToArray() ?? []));
    }

    private static ServerAuthorizationRequest Request(
        string permissionCode,
        bool ownerOnly = false,
        IReadOnlyList<string>? dependencies = null,
        ServerPermissionResource? permissionResource = null,
        ServerAuthorizationTarget? target = null)
    {
        return new ServerAuthorizationRequest(
            ServerId,
            permissionCode,
            ownerOnly,
            dependencies ?? [],
            permissionResource,
            target);
    }

    private static ServerPermissionResource Resource(
        IReadOnlyList<ServerPermissionScope>? categories = null,
        ServerPermissionScope? space = null)
    {
        return new ServerPermissionResource(
            ServerId,
            categories ?? [],
            space);
    }

    private static ServerPermissionScope Scope(
        params ServerPermissionOverride[] overrides)
    {
        return new ServerPermissionScope(
            ServerId,
            Guid.NewGuid(),
            overrides);
    }

    private static ServerPermissionOverride RoleOverride(
        Guid roleId,
        PermissionMask256? allow = null,
        PermissionMask256? deny = null,
        ServerRoleAuthority? protectionAuthority = null)
    {
        return Override(
            ServerPermissionOverrideTargetKind.Role,
            roleId,
            allow,
            deny,
            protectionAuthority);
    }

    private static ServerPermissionOverride MemberOverride(
        PermissionMask256? allow = null,
        PermissionMask256? deny = null,
        ServerRoleAuthority? protectionAuthority = null)
    {
        return Override(
            ServerPermissionOverrideTargetKind.Member,
            MemberId,
            allow,
            deny,
            protectionAuthority);
    }

    private static ServerPermissionOverride Override(
        ServerPermissionOverrideTargetKind targetKind,
        Guid targetId,
        PermissionMask256? allow,
        PermissionMask256? deny,
        ServerRoleAuthority? protectionAuthority)
    {
        return new ServerPermissionOverride(
            ServerId,
            ServerId,
            targetKind,
            targetId,
            allow ?? PermissionMask256.Empty,
            deny ?? PermissionMask256.Empty,
            protectionAuthority);
    }

    private static PermissionMask256 Mask(params string[] permissionCodes)
    {
        return ServerPermissionRegistry.CreateMask(permissionCodes);
    }
}
