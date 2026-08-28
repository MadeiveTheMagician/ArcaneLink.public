using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;

namespace ArcaneLink.Services.Servers
{
    internal static class ServerInviteRules
    {
        public const string DirectKindCode = "direct";
        public const string LinkKindCode = "link";
        public static readonly TimeSpan DirectInviteLifetime = TimeSpan.FromDays(7);

        public static bool IsActive(ServerInvite invite, DateTime now)
        {
            var isDirect = invite.KindId == ServerGovernanceIds.InviteKindDirect;
            var expiresAt = isDirect
                ? MinExpiration(invite.ExpiresAt, invite.CreatedAt + DirectInviteLifetime)
                : invite.ExpiresAt;
            var hasRemainingUses = isDirect
                ? invite.UsedCount < 1
                : invite.MaxUses == null || invite.UsedCount < invite.MaxUses;

            return invite.RevokedAt == null &&
                   (expiresAt == null || expiresAt > now) &&
                   hasRemainingUses &&
                   invite.Server?.DeletedAt == null;
        }

        public static string NormalizeCode(string value) => value.Trim().ToLowerInvariant();

        private static DateTime? MinExpiration(DateTime? first, DateTime second)
        {
            return first == null || first > second ? second : first;
        }
    }
}
