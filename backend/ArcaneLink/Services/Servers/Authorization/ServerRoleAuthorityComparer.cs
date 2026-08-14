namespace ArcaneLink.Services.Servers.Authorization
{
    public static class ServerRoleAuthorityComparer
    {
        public static bool CanManageResource(
            ServerRoleAuthority actor,
            ServerRoleAuthority protection)
        {
            return TryCompare(actor, protection, out var comparison) &&
                   comparison >= 0;
        }

        public static bool CanAffectSubject(
            ServerRoleAuthority actor,
            ServerRoleAuthority subject)
        {
            if (subject.Tier == ServerRoleAuthorityTier.Owner)
            {
                return false;
            }

            return TryCompare(actor, subject, out var comparison) &&
                   comparison > 0;
        }

        public static bool TryCompare(
            ServerRoleAuthority left,
            ServerRoleAuthority right,
            out int comparison)
        {
            comparison = 0;
            if (!IsValid(left) ||
                !IsValid(right) ||
                left.ServerId != right.ServerId)
            {
                return false;
            }

            comparison = left.Tier.CompareTo(right.Tier);
            if (comparison != 0)
            {
                return true;
            }

            comparison = left.Tier switch
            {
                ServerRoleAuthorityTier.Standard or
                    ServerRoleAuthorityTier.Administrator =>
                    right.Position.CompareTo(left.Position),
                _ => 0
            };
            return true;
        }

        private static bool IsValid(ServerRoleAuthority authority)
        {
            if (authority.ServerId == Guid.Empty ||
                !Enum.IsDefined(authority.Tier))
            {
                return false;
            }

            return authority.Tier is
                       ServerRoleAuthorityTier.Owner or
                       ServerRoleAuthorityTier.Everyone ||
                   authority.Position >= 0;
        }
    }
}
