using ArcaneLink.DataBase.Constants;

namespace ArcaneLink.Services.Spaces;

public static class SpaceAccessEvaluator
{
    public static SpaceAuthorizationSnapshot Evaluate(
        SpaceAccessPrincipal principal,
        IReadOnlyCollection<SpaceAccessNode> spaces)
    {
        var nodes = spaces
            .GroupBy(x => x.Id)
            .ToDictionary(group => group.Key, group => group.First());
        var capabilities = new Dictionary<Guid, SpaceAccessCapabilities>();

        if (!principal.IsActiveMember)
        {
            foreach (var node in nodes.Values)
            {
                capabilities[node.Id] = DeniedCapabilities;
            }

            return new SpaceAuthorizationSnapshot(capabilities);
        }

        if (principal.IsOwner || principal.HasManageServer)
        {
            foreach (var node in nodes.Values)
            {
                capabilities[node.Id] = CreateBypassCapabilities(node.TypeId);
            }

            return new SpaceAuthorizationSnapshot(capabilities);
        }

        var states = new Dictionary<Guid, EvaluationState>();
        var visiting = new HashSet<Guid>();
        foreach (var node in nodes.Values)
        {
            var state = EvaluateNode(
                node,
                principal,
                nodes,
                states,
                visiting);
            capabilities[node.Id] = ToCapabilities(node.TypeId, state);
        }

        return new SpaceAuthorizationSnapshot(capabilities);
    }

    public static SpaceAccessCapabilities EvaluateTarget(
        SpaceAccessPrincipal principal,
        IReadOnlyDictionary<Guid, SpaceAccessNode> nodes,
        Guid spaceId)
    {
        if (!nodes.TryGetValue(spaceId, out var node) ||
            !principal.IsActiveMember)
        {
            return DeniedCapabilities;
        }

        if (principal.IsOwner || principal.HasManageServer)
        {
            return CreateBypassCapabilities(node.TypeId);
        }

        var state = EvaluateNode(
            node,
            principal,
            nodes,
            new Dictionary<Guid, EvaluationState>(),
            new HashSet<Guid>());
        return ToCapabilities(node.TypeId, state);
    }

    private static EvaluationState EvaluateNode(
        SpaceAccessNode node,
        SpaceAccessPrincipal principal,
        IReadOnlyDictionary<Guid, SpaceAccessNode> nodes,
        IDictionary<Guid, EvaluationState> states,
        ISet<Guid> visiting)
    {
        if (states.TryGetValue(node.Id, out var cached))
        {
            return cached;
        }

        if (!visiting.Add(node.Id))
        {
            return EvaluationState.Invalid;
        }

        EvaluationState state;
        if (node.ParentSpaceId.HasValue)
        {
            if (!nodes.TryGetValue(node.ParentSpaceId.Value, out var parent))
            {
                state = EvaluationState.Invalid;
            }
            else
            {
                var parentState = EvaluateNode(
                    parent,
                    principal,
                    nodes,
                    states,
                    visiting);
                state = !parentState.IsValid || !parentState.CanView
                    ? EvaluationState.Invalid
                    : parentState;
            }
        }
        else
        {
            state = EvaluationState.Default;
        }

        visiting.Remove(node.Id);

        if (!state.IsValid)
        {
            states[node.Id] = EvaluationState.Invalid;
            return EvaluationState.Invalid;
        }

        var canView = !node.RequiredRoleId.HasValue ||
                      principal.RoleIds.Contains(node.RequiredRoleId.Value);
        canView = ApplyOverride(
            node,
            principal,
            SpacePermissionIds.ViewSpace,
            canView);

        if (!canView)
        {
            state = state with { CanView = false };
            states[node.Id] = state;
            return state;
        }

        state = state with
        {
            CanView = true,
            CanSendMessages = ApplyOverride(
                node,
                principal,
                SpacePermissionIds.SendMessages,
                state.CanSendMessages),
            CanConnectVoice = ApplyOverride(
                node,
                principal,
                SpacePermissionIds.ConnectVoice,
                state.CanConnectVoice),
            CanManage = ApplyOverride(
                node,
                principal,
                SpacePermissionIds.ManageSpace,
                state.CanManage)
        };
        states[node.Id] = state;
        return state;
    }

    private static bool ApplyOverride(
        SpaceAccessNode node,
        SpaceAccessPrincipal principal,
        Guid permissionId,
        bool inheritedValue)
    {
        var memberOverrides = node.Overrides
            .Where(x =>
                x.PermissionId == permissionId &&
                x.MemberId.HasValue &&
                x.MemberId == principal.MemberId)
            .ToList();
        if (memberOverrides.Count > 0)
        {
            if (memberOverrides.Any(x => x.Deny))
            {
                return false;
            }

            if (memberOverrides.Any(x => x.Allow))
            {
                return true;
            }
        }

        var roleOverrides = node.Overrides
            .Where(x =>
                x.PermissionId == permissionId &&
                x.RoleId.HasValue &&
                principal.RoleIds.Contains(x.RoleId.Value))
            .ToList();
        if (roleOverrides.Any(x => x.Deny))
        {
            return false;
        }

        return roleOverrides.Any(x => x.Allow)
            ? true
            : inheritedValue;
    }

    private static SpaceAccessCapabilities ToCapabilities(
        Guid typeId,
        EvaluationState state)
    {
        if (!state.IsValid || !state.CanView)
        {
            return DeniedCapabilities;
        }

        return new SpaceAccessCapabilities(
            CanView: true,
            CanSendMessages:
                (typeId == SpaceIds.TypeTextRoom ||
                 typeId == SpaceIds.TypeVoiceRoom) &&
                state.CanSendMessages,
            CanConnectVoice:
                typeId == SpaceIds.TypeVoiceRoom &&
                state.CanConnectVoice,
            CanManage: state.CanManage);
    }

    private static SpaceAccessCapabilities CreateBypassCapabilities(Guid typeId)
    {
        return new SpaceAccessCapabilities(
            CanView: true,
            CanSendMessages:
                typeId == SpaceIds.TypeTextRoom ||
                typeId == SpaceIds.TypeVoiceRoom,
            CanConnectVoice: typeId == SpaceIds.TypeVoiceRoom,
            CanManage: true);
    }

    private static readonly SpaceAccessCapabilities DeniedCapabilities =
        new(false, false, false, false);

    private sealed record EvaluationState(
        bool IsValid,
        bool CanView,
        bool CanSendMessages,
        bool CanConnectVoice,
        bool CanManage)
    {
        public static EvaluationState Default { get; } =
            new(true, true, true, true, false);
        public static EvaluationState Invalid { get; } =
            new(false, false, false, false, false);
    }
}
