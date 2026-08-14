using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.Spaces;

namespace ArcaneLink.Tests.Spaces;

public sealed class SpaceAccessEvaluatorTests
{
    private static readonly Guid UserId = Guid.Parse("10000000-0000-0000-0000-000000000001");
    private static readonly Guid MemberId = Guid.Parse("10000000-0000-0000-0000-000000000002");
    private static readonly Guid RoleAllowId = Guid.Parse("10000000-0000-0000-0000-000000000003");
    private static readonly Guid RoleDenyId = Guid.Parse("10000000-0000-0000-0000-000000000004");

    [Fact]
    public void Defaults_AreOpenForViewAndTypeSpecificUse_ButClosedForManage()
    {
        var category = Node(SpaceIds.TypeCategory);
        var text = Node(SpaceIds.TypeTextRoom);
        var voice = Node(SpaceIds.TypeVoiceRoom);

        var snapshot = SpaceAccessEvaluator.Evaluate(
            Principal(),
            [category, text, voice]);

        Assert.Equal(
            new SpaceAccessCapabilities(true, false, false, false),
            snapshot.GetCapabilities(category.Id));
        Assert.Equal(
            new SpaceAccessCapabilities(true, true, false, false),
            snapshot.GetCapabilities(text.Id));
        Assert.Equal(
            new SpaceAccessCapabilities(true, true, true, false),
            snapshot.GetCapabilities(voice.Id));
    }

    [Fact]
    public void RoleDenyBeatsRoleAllow_ButMemberAllowBeatsRoles()
    {
        var text = Node(
            SpaceIds.TypeTextRoom,
            overrides:
            [
                RoleOverride(RoleAllowId, SpacePermissionIds.SendMessages, allow: true),
                RoleOverride(RoleDenyId, SpacePermissionIds.SendMessages, deny: true),
                MemberOverride(SpacePermissionIds.SendMessages, allow: true)
            ]);

        var snapshot = SpaceAccessEvaluator.Evaluate(
            Principal([RoleAllowId, RoleDenyId]),
            [text]);

        Assert.True(snapshot.Can(text.Id, SpaceAction.Send));
    }

    [Fact]
    public void MemberViewOverride_CanReplaceLocalRequiredRoleResult()
    {
        var text = Node(
            SpaceIds.TypeTextRoom,
            requiredRoleId: RoleAllowId,
            overrides:
            [
                MemberOverride(SpacePermissionIds.ViewSpace, allow: true)
            ]);

        var snapshot = SpaceAccessEvaluator.Evaluate(Principal(), [text]);

        Assert.True(snapshot.Can(text.Id, SpaceAction.View));
        Assert.True(snapshot.Can(text.Id, SpaceAction.Send));
    }

    [Fact]
    public void MemberViewDeny_CanDenyARequiredRoleMember()
    {
        var text = Node(
            SpaceIds.TypeTextRoom,
            requiredRoleId: RoleAllowId,
            overrides:
            [
                MemberOverride(SpacePermissionIds.ViewSpace, deny: true)
            ]);

        var snapshot = SpaceAccessEvaluator.Evaluate(
            Principal([RoleAllowId]),
            [text]);

        Assert.False(snapshot.Can(text.Id, SpaceAction.View));
        Assert.False(snapshot.Can(text.Id, SpaceAction.Send));
    }

    [Fact]
    public void AncestorViewDeny_IsAHardSubtreeGate()
    {
        var category = Node(
            SpaceIds.TypeCategory,
            overrides:
            [
                MemberOverride(SpacePermissionIds.ViewSpace, deny: true)
            ]);
        var child = Node(
            SpaceIds.TypeTextRoom,
            parentSpaceId: category.Id,
            overrides:
            [
                MemberOverride(SpacePermissionIds.ViewSpace, allow: true)
            ]);

        var snapshot = SpaceAccessEvaluator.Evaluate(
            Principal(),
            [category, child]);

        Assert.False(snapshot.Can(category.Id, SpaceAction.View));
        Assert.False(snapshot.Can(child.Id, SpaceAction.View));
    }

    [Fact]
    public void ChildCanReplaceInheritedSendConnectAndManagePolicies()
    {
        var category = Node(
            SpaceIds.TypeCategory,
            overrides:
            [
                MemberOverride(SpacePermissionIds.SendMessages, deny: true),
                MemberOverride(SpacePermissionIds.ConnectVoice, deny: true),
                MemberOverride(SpacePermissionIds.ManageSpace, allow: true)
            ]);
        var text = Node(
            SpaceIds.TypeTextRoom,
            parentSpaceId: category.Id,
            overrides:
            [
                MemberOverride(SpacePermissionIds.SendMessages, allow: true),
                MemberOverride(SpacePermissionIds.ManageSpace, deny: true)
            ]);
        var voice = Node(
            SpaceIds.TypeVoiceRoom,
            parentSpaceId: category.Id,
            overrides:
            [
                MemberOverride(SpacePermissionIds.ConnectVoice, allow: true)
            ]);

        var snapshot = SpaceAccessEvaluator.Evaluate(
            Principal(),
            [category, text, voice]);

        Assert.True(snapshot.Can(text.Id, SpaceAction.Send));
        Assert.False(snapshot.Can(text.Id, SpaceAction.Manage));
        Assert.True(snapshot.Can(voice.Id, SpaceAction.Connect));
        Assert.True(snapshot.Can(voice.Id, SpaceAction.Manage));
    }

    [Theory]
    [InlineData(true, false, true)]
    [InlineData(false, true, true)]
    [InlineData(false, false, false)]
    public void ActiveOwnerOrManageServerBypassesOverrides(
        bool isOwner,
        bool hasManageServer,
        bool expected)
    {
        var text = Node(
            SpaceIds.TypeTextRoom,
            requiredRoleId: RoleAllowId,
            overrides:
            [
                MemberOverride(SpacePermissionIds.ViewSpace, deny: true),
                MemberOverride(SpacePermissionIds.SendMessages, deny: true),
                MemberOverride(SpacePermissionIds.ManageSpace, deny: true)
            ]);
        var principal = Principal(
            isOwner: isOwner,
            hasManageServer: hasManageServer);

        var snapshot = SpaceAccessEvaluator.Evaluate(principal, [text]);

        Assert.Equal(expected, snapshot.Can(text.Id, SpaceAction.View));
        Assert.Equal(expected, snapshot.Can(text.Id, SpaceAction.Send));
        Assert.Equal(expected, snapshot.Can(text.Id, SpaceAction.Manage));
    }

    [Fact]
    public void InactiveOwnerIsDeniedBeforeBypass()
    {
        var text = Node(SpaceIds.TypeTextRoom);
        var principal = Principal(isActive: false, isOwner: true, hasManageServer: true);

        var snapshot = SpaceAccessEvaluator.Evaluate(principal, [text]);

        Assert.False(snapshot.Can(text.Id, SpaceAction.View));
    }

    [Fact]
    public void MissingParentAndCyclesFailClosed()
    {
        var missingParent = Node(
            SpaceIds.TypeTextRoom,
            parentSpaceId: Guid.NewGuid());
        var firstId = Guid.NewGuid();
        var secondId = Guid.NewGuid();
        var first = Node(
            SpaceIds.TypeCategory,
            id: firstId,
            parentSpaceId: secondId);
        var second = Node(
            SpaceIds.TypeCategory,
            id: secondId,
            parentSpaceId: firstId);

        var snapshot = SpaceAccessEvaluator.Evaluate(
            Principal(),
            [missingParent, first, second]);

        Assert.False(snapshot.Can(missingParent.Id, SpaceAction.View));
        Assert.False(snapshot.Can(first.Id, SpaceAction.View));
        Assert.False(snapshot.Can(second.Id, SpaceAction.View));
    }

    [Fact]
    public void TargetEvaluation_MatchesFullGraphEvaluation()
    {
        var root = Node(
            SpaceIds.TypeCategory,
            overrides:
            [
                RoleOverride(RoleAllowId, SpacePermissionIds.ManageSpace, allow: true),
                RoleOverride(RoleDenyId, SpacePermissionIds.SendMessages, deny: true)
            ]);
        var child = Node(
            SpaceIds.TypeTextRoom,
            parentSpaceId: root.Id,
            overrides:
            [
                MemberOverride(SpacePermissionIds.SendMessages, allow: true)
            ]);
        var unrelated = Enumerable.Range(0, 250)
            .Select(_ => Node(SpaceIds.TypeTextRoom))
            .ToList();
        List<SpaceAccessNode> spaces = [root, child, .. unrelated];
        var nodes = spaces.ToDictionary(node => node.Id);

        foreach (var principal in new[]
                 {
                     Principal([RoleAllowId, RoleDenyId]),
                     Principal(isOwner: true),
                     Principal(isActive: false)
                 })
        {
            var full = SpaceAccessEvaluator
                .Evaluate(principal, spaces)
                .GetCapabilities(child.Id);
            var targeted = SpaceAccessEvaluator.EvaluateTarget(
                principal,
                nodes,
                child.Id);

            Assert.Equal(full, targeted);
        }
    }

    [Fact]
    public void TargetEvaluation_ScalesToTenThousandPrincipals()
    {
        var root = Node(SpaceIds.TypeCategory);
        var target = Node(
            SpaceIds.TypeTextRoom,
            parentSpaceId: root.Id);
        var unrelated = Enumerable.Range(0, 1_000)
            .Select(_ => Node(SpaceIds.TypeTextRoom))
            .ToList();
        List<SpaceAccessNode> spaces = [root, target, .. unrelated];
        var nodes = spaces.ToDictionary(node => node.Id);
        var allowed = 0;

        for (var index = 0; index < 10_000; index++)
        {
            var principal = new SpaceAccessPrincipal(
                Guid.NewGuid(),
                Guid.NewGuid(),
                IsActiveMember: true,
                IsOwner: false,
                HasManageServer: false,
                RoleIds: new HashSet<Guid>());
            if (SpaceAccessEvaluator
                .EvaluateTarget(principal, nodes, target.Id)
                .CanSendMessages)
            {
                allowed++;
            }
        }

        Assert.Equal(10_000, allowed);
    }

    private static SpaceAccessPrincipal Principal(
        IEnumerable<Guid>? roles = null,
        bool isActive = true,
        bool isOwner = false,
        bool hasManageServer = false)
    {
        return new SpaceAccessPrincipal(
            UserId,
            MemberId,
            isActive,
            isOwner,
            hasManageServer,
            roles?.ToHashSet() ?? []);
    }

    private static SpaceAccessNode Node(
        Guid typeId,
        Guid? id = null,
        Guid? parentSpaceId = null,
        Guid? requiredRoleId = null,
        IReadOnlyList<SpaceAccessOverride>? overrides = null)
    {
        return new SpaceAccessNode(
            id ?? Guid.NewGuid(),
            parentSpaceId,
            typeId,
            requiredRoleId,
            overrides ?? []);
    }

    private static SpaceAccessOverride RoleOverride(
        Guid roleId,
        Guid permissionId,
        bool allow = false,
        bool deny = false)
    {
        return new SpaceAccessOverride(
            roleId,
            null,
            permissionId,
            allow,
            deny);
    }

    private static SpaceAccessOverride MemberOverride(
        Guid permissionId,
        bool allow = false,
        bool deny = false)
    {
        return new SpaceAccessOverride(
            null,
            MemberId,
            permissionId,
            allow,
            deny);
    }
}
