namespace ArcaneLink.Services.Servers.Authorization
{
    public sealed class ServerAuthorizationShadowOptions
    {
        public const string SectionName = "AuthorizationShadow";

        public bool Enabled { get; set; }
        public string[] EnforcedPermissionCodes { get; set; } = [];

        public bool IsEnforced(string permissionCode)
        {
            return EnforcedPermissionCodes?.Contains(
                       permissionCode,
                       StringComparer.OrdinalIgnoreCase) == true;
        }

        public bool HasValidEnforcementConfiguration()
        {
            return EnforcedPermissionCodes != null &&
                   EnforcedPermissionCodes.All(
                       LegacyServerPermissionMaskAdapter
                           .IsRepresentativePermissionCode);
        }
    }
}
