using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeDirectInviteLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE server_invites AS invite
                SET max_uses = 1,
                    expires_at = LEAST(
                        COALESCE(invite.expires_at, invite.created_at + INTERVAL '7 days'),
                        invite.created_at + INTERVAL '7 days')
                FROM server_invite_kinds AS kind
                WHERE invite.kind_id = kind.id
                  AND kind.code = 'direct';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE server_invites AS invite
                SET max_uses = NULL,
                    expires_at = NULL
                FROM server_invite_kinds AS kind
                WHERE invite.kind_id = kind.id
                  AND kind.code = 'direct';
                """);
        }
    }
}
