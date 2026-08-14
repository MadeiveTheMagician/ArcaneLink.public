using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddSpaceReadStates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "space_read_states",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
                    last_read_message_id = table.Column<Guid>(type: "uuid", nullable: true),
                    last_read_message_created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    read_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_read_states", x => new { x.user_id, x.space_id });
                    table.ForeignKey(
                        name: "FK_space_read_states_space_messages_last_read_message_id",
                        column: x => x.last_read_message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_space_read_states_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_space_read_states_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_Unread",
                table: "space_messages",
                columns: new[] { "space_id", "created_at", "id" },
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceReadStates_LastMessage",
                table: "space_read_states",
                column: "last_read_message_id");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceReadStates_Space_User",
                table: "space_read_states",
                columns: new[] { "space_id", "user_id" });

            // Existing active memberships start at the current end of each text
            // space. This prevents deployment from turning the full message
            // history into unread content. Server ACL still controls whether the
            // state can be observed or changed; pre-seeding hidden spaces avoids
            // exposing old history as new if access is granted later.
            migrationBuilder.Sql(
                """
                WITH active_memberships AS (
                    SELECT sm.user_id, s.id AS space_id
                    FROM server_members AS sm
                    INNER JOIN spaces AS s ON s.server_id = sm.server_id
                    WHERE sm.status_id = '40000000-0000-0000-0000-000000000000'::uuid
                      AND s.type_id = '25000000-0000-0000-0000-000000000002'::uuid
                      AND s.deleted_at IS NULL

                    UNION ALL

                    SELECT psm.user_id, ps.space_id
                    FROM private_space_members AS psm
                    INNER JOIN private_spaces AS ps ON ps.space_id = psm.space_id
                    INNER JOIN spaces AS s ON s.id = ps.space_id
                    WHERE psm.status_id = '26000000-0000-0000-0000-000000000001'::uuid
                      AND ps.deleted_at IS NULL
                      AND s.deleted_at IS NULL
                )
                INSERT INTO space_read_states (
                    user_id,
                    space_id,
                    last_read_message_id,
                    last_read_message_created_at,
                    read_at,
                    updated_at)
                SELECT
                    membership.user_id,
                    membership.space_id,
                    latest_message.id,
                    latest_message.created_at,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                FROM active_memberships AS membership
                INNER JOIN LATERAL (
                    SELECT message.id, message.created_at
                    FROM space_messages AS message
                    WHERE message.space_id = membership.space_id
                      AND message.deleted_at IS NULL
                    ORDER BY message.created_at DESC, message.id DESC
                    LIMIT 1
                ) AS latest_message ON TRUE
                ON CONFLICT (user_id, space_id) DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "space_read_states");

            migrationBuilder.DropIndex(
                name: "IX_SpaceMessages_Unread",
                table: "space_messages");
        }
    }
}
