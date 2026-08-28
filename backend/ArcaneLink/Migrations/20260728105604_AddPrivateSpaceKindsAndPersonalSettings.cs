using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateSpaceKindsAndPersonalSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "avatar_asset_id",
                table: "private_spaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "avatar_crop_offset_x",
                table: "private_spaces",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "avatar_crop_offset_y",
                table: "private_spaces",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "avatar_crop_zoom",
                table: "private_spaces",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);

            migrationBuilder.AddColumn<Guid>(
                name: "direct_user_high_id",
                table: "private_spaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "direct_user_low_id",
                table: "private_spaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "private_spaces",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "owner_user_id",
                table: "private_spaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_muted_indefinitely",
                table: "private_space_members",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "muted_until",
                table: "private_space_members",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "note",
                table: "private_space_members",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "peer_avatar_asset_id",
                table: "private_space_members",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "peer_avatar_crop_offset_x",
                table: "private_space_members",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "peer_avatar_crop_offset_y",
                table: "private_space_members",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "peer_avatar_crop_zoom",
                table: "private_space_members",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);

            migrationBuilder.AddColumn<string>(
                name: "peer_nickname",
                table: "private_space_members",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "pinned_at",
                table: "private_space_members",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "pinned_at",
                table: "private_space_folder_items",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "private_message_recipients",
                columns: table => new
                {
                    message_id = table.Column<Guid>(
                        type: "uuid",
                        nullable: false),
                    user_id = table.Column<Guid>(
                        type: "uuid",
                        nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "PK_private_message_recipients",
                        x => new { x.message_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_private_message_recipients_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_private_message_recipients_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.Sql(
                """
                UPDATE private_spaces AS private_space
                SET owner_user_id = COALESCE(
                        (
                            SELECT member.user_id
                            FROM private_space_members AS member
                            WHERE member.space_id = private_space.space_id
                              AND member.status_id =
                                  '26000000-0000-0000-0000-000000000001'
                            ORDER BY
                                CASE
                                    WHEN member.user_id =
                                         private_space.created_by_user_id
                                        THEN 0
                                    ELSE 1
                                END,
                                member.joined_at,
                                member.created_at,
                                member.id
                            LIMIT 1
                        ),
                        private_space.created_by_user_id
                    ),
                    kind = 'group',
                    direct_user_low_id = NULL,
                    direct_user_high_id = NULL;

                WITH two_member_spaces AS (
                    SELECT
                        private_space.space_id,
                        private_space.created_at,
                        (array_agg(member.user_id ORDER BY member.user_id))[1]
                            AS low_user_id,
                        (array_agg(member.user_id ORDER BY member.user_id))[2]
                            AS high_user_id
                    FROM private_spaces AS private_space
                    INNER JOIN private_space_members AS member
                        ON member.space_id = private_space.space_id
                    GROUP BY private_space.space_id, private_space.created_at
                    HAVING COUNT(*) = 2
                ),
                ranked_direct_candidates AS (
                    SELECT
                        candidate.space_id,
                        candidate.low_user_id,
                        candidate.high_user_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY
                                candidate.low_user_id,
                                candidate.high_user_id
                            ORDER BY
                                candidate.created_at,
                                candidate.space_id
                        ) AS pair_rank
                    FROM two_member_spaces AS candidate
                )
                UPDATE private_spaces AS private_space
                SET kind = 'direct',
                    direct_user_low_id = candidate.low_user_id,
                    direct_user_high_id = candidate.high_user_id
                FROM ranked_direct_candidates AS candidate
                WHERE private_space.space_id = candidate.space_id
                  AND candidate.pair_rank = 1;

                INSERT INTO private_message_recipients (message_id, user_id)
                SELECT message.id, member.user_id
                FROM space_messages AS message
                INNER JOIN private_spaces AS private_space
                    ON private_space.space_id = message.space_id
                INNER JOIN private_space_members AS member
                    ON member.space_id = message.space_id
                WHERE member.user_id <> message.sender_user_id
                  AND member.joined_at <= message.created_at
                  AND (
                      member.left_at IS NULL OR
                      member.left_at >= message.created_at
                  )
                ON CONFLICT (message_id, user_id) DO NOTHING;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "kind",
                table: "private_spaces",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16,
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "owner_user_id",
                table: "private_spaces",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_private_spaces_avatar_asset_id",
                table: "private_spaces",
                column: "avatar_asset_id");

            migrationBuilder.CreateIndex(
                name: "IX_private_spaces_direct_user_high_id",
                table: "private_spaces",
                column: "direct_user_high_id");

            migrationBuilder.CreateIndex(
                name: "IX_private_spaces_owner_user_id",
                table: "private_spaces",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "UX_PrivateSpaces_DirectPair",
                table: "private_spaces",
                columns: new[] { "direct_user_low_id", "direct_user_high_id" },
                unique: true,
                filter: "\"direct_user_low_id\" IS NOT NULL AND \"direct_user_high_id\" IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PrivateSpaces_DirectPair",
                table: "private_spaces",
                sql: "(kind = 'direct' AND direct_user_low_id IS NOT NULL AND direct_user_high_id IS NOT NULL AND direct_user_low_id < direct_user_high_id) OR (kind = 'group' AND direct_user_low_id IS NULL AND direct_user_high_id IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceMembers_User_Status_PinnedAt",
                table: "private_space_members",
                columns: new[] { "user_id", "status_id", "pinned_at" });

            migrationBuilder.CreateIndex(
                name: "IX_private_space_members_peer_avatar_asset_id",
                table: "private_space_members",
                column: "peer_avatar_asset_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PrivateSpaceMembers_Mute",
                table: "private_space_members",
                sql: "NOT (is_muted_indefinitely AND muted_until IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceFolderItems_Folder_PinnedAt",
                table: "private_space_folder_items",
                columns: new[] { "folder_id", "pinned_at" });

            migrationBuilder.CreateIndex(
                name: "IX_PrivateMessageRecipients_User_Message",
                table: "private_message_recipients",
                columns: new[] { "user_id", "message_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_private_space_members_assets_peer_avatar_asset_id",
                table: "private_space_members",
                column: "peer_avatar_asset_id",
                principalTable: "assets",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_private_spaces_assets_avatar_asset_id",
                table: "private_spaces",
                column: "avatar_asset_id",
                principalTable: "assets",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_private_spaces_users_direct_user_high_id",
                table: "private_spaces",
                column: "direct_user_high_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_private_spaces_users_direct_user_low_id",
                table: "private_spaces",
                column: "direct_user_low_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_private_spaces_users_owner_user_id",
                table: "private_spaces",
                column: "owner_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "private_message_recipients");

            migrationBuilder.DropForeignKey(
                name: "FK_private_space_members_assets_peer_avatar_asset_id",
                table: "private_space_members");

            migrationBuilder.DropForeignKey(
                name: "FK_private_spaces_assets_avatar_asset_id",
                table: "private_spaces");

            migrationBuilder.DropForeignKey(
                name: "FK_private_spaces_users_direct_user_high_id",
                table: "private_spaces");

            migrationBuilder.DropForeignKey(
                name: "FK_private_spaces_users_direct_user_low_id",
                table: "private_spaces");

            migrationBuilder.DropForeignKey(
                name: "FK_private_spaces_users_owner_user_id",
                table: "private_spaces");

            migrationBuilder.DropIndex(
                name: "IX_private_spaces_avatar_asset_id",
                table: "private_spaces");

            migrationBuilder.DropIndex(
                name: "IX_private_spaces_direct_user_high_id",
                table: "private_spaces");

            migrationBuilder.DropIndex(
                name: "IX_private_spaces_owner_user_id",
                table: "private_spaces");

            migrationBuilder.DropIndex(
                name: "UX_PrivateSpaces_DirectPair",
                table: "private_spaces");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PrivateSpaces_DirectPair",
                table: "private_spaces");

            migrationBuilder.DropIndex(
                name: "IX_PrivateSpaceMembers_User_Status_PinnedAt",
                table: "private_space_members");

            migrationBuilder.DropIndex(
                name: "IX_private_space_members_peer_avatar_asset_id",
                table: "private_space_members");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PrivateSpaceMembers_Mute",
                table: "private_space_members");

            migrationBuilder.DropIndex(
                name: "IX_PrivateSpaceFolderItems_Folder_PinnedAt",
                table: "private_space_folder_items");

            migrationBuilder.DropColumn(
                name: "avatar_asset_id",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "avatar_crop_offset_x",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "avatar_crop_offset_y",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "avatar_crop_zoom",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "direct_user_high_id",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "direct_user_low_id",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "owner_user_id",
                table: "private_spaces");

            migrationBuilder.DropColumn(
                name: "is_muted_indefinitely",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "muted_until",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "note",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "peer_avatar_asset_id",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "peer_avatar_crop_offset_x",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "peer_avatar_crop_offset_y",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "peer_avatar_crop_zoom",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "peer_nickname",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "pinned_at",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "pinned_at",
                table: "private_space_folder_items");
        }
    }
}
