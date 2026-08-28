using ArcaneLink.DataBase.Constants;

namespace ArcaneLink.Services.Spaces
{
    public enum SpaceAction
    {
        View,
        Send,
        Connect,
        Manage
    }

    public sealed record SpaceAccessCapabilities(
        bool CanView,
        bool CanSendMessages,
        bool CanConnectVoice,
        bool CanManage,
        bool CanManageSpaceAccess = false);

    public sealed record SpaceAuthorizationProtection(
        Guid? RoleId,
        Guid? CreatedByUserId);

    public sealed record SpaceAuthorizationRequirement(
        string PermissionCode,
        bool OwnerOnly = false,
        IReadOnlyList<string>? DependencyCodes = null,
        SpaceAuthorizationProtection? Protection = null);

    public sealed record SpaceAccessPrincipal(
        Guid UserId,
        Guid? MemberId,
        bool IsActiveMember,
        bool IsOwner,
        bool HasManageServer,
        IReadOnlySet<Guid> RoleIds);

    public sealed record SpaceAccessOverride(
        Guid? RoleId,
        Guid? MemberId,
        Guid PermissionId,
        bool Allow,
        bool Deny,
        Guid? CreatedByUserId = null,
        Guid? ProtectionRoleId = null);

    public sealed record SpaceAccessNode(
        Guid Id,
        Guid? ParentSpaceId,
        Guid TypeId,
        Guid? RequiredRoleId,
        IReadOnlyList<SpaceAccessOverride> Overrides);

    public sealed class SpaceAuthorizationSnapshot
    {
        private readonly IReadOnlyDictionary<Guid, SpaceAccessCapabilities> _capabilities;

        public SpaceAuthorizationSnapshot(
            IReadOnlyDictionary<Guid, SpaceAccessCapabilities> capabilities)
        {
            this._capabilities = capabilities;
        }

        public IReadOnlyDictionary<Guid, SpaceAccessCapabilities> Capabilities =>
            this._capabilities;

        public SpaceAccessCapabilities? GetCapabilities(Guid spaceId)
        {
            return this._capabilities.GetValueOrDefault(spaceId);
        }

        public bool Can(Guid spaceId, SpaceAction action)
        {
            var capabilities = this.GetCapabilities(spaceId);
            return capabilities != null && action switch
            {
                SpaceAction.View => capabilities.CanView,
                SpaceAction.Send => capabilities.CanSendMessages,
                SpaceAction.Connect => capabilities.CanConnectVoice,
                SpaceAction.Manage => capabilities.CanManage,
                _ => false
            };
        }

        public IReadOnlyList<Guid> GetAllowedSpaceIds(SpaceAction action)
        {
            return this._capabilities
                .Where(item => this.Can(item.Key, action))
                .Select(item => item.Key)
                .ToList();
        }
    }
}
