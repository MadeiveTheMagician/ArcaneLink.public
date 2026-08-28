using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddVoiceChatCompanionsAndPresenceVisibilityCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_PresenceVisibility",
                table: "user_profile_settings");

            migrationBuilder.AlterColumn<string>(
                name: "presence_visibility",
                table: "user_profile_settings",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "everyone",
                oldClrType: typeof(string),
                oldType: "character varying(16)",
                oldMaxLength: 16,
                oldDefaultValue: "everyone");

            migrationBuilder.AddColumn<Guid>(
                name: "parent_voice_space_id",
                table: "spaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql(
                """
                LOCK TABLE
                    "spaces",
                    "space_messages",
                    "space_read_states",
                    "space_pinned_messages",
                    "moderation_cases"
                IN SHARE ROW EXCLUSIVE MODE;

                INSERT INTO "spaces" (
                    "id",
                    "server_id",
                    "type_id",
                    "parent_space_id",
                    "parent_voice_space_id",
                    "created_by_user_id",
                    "title",
                    "description",
                    "required_server_role_id",
                    "position",
                    "is_system",
                    "created_at",
                    "updated_at",
                    "deleted_at"
                )
                SELECT
                    gen_random_uuid(),
                    voice."server_id",
                    '25000000-0000-0000-0000-000000000002'::uuid,
                    NULL,
                    voice."id",
                    voice."created_by_user_id",
                    voice."title",
                    voice."description",
                    NULL,
                    0,
                    TRUE,
                    voice."created_at",
                    voice."updated_at",
                    voice."deleted_at"
                FROM "spaces" AS voice
                WHERE voice."type_id" =
                          '25000000-0000-0000-0000-000000000003'::uuid
                  AND voice."parent_voice_space_id" IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM "spaces" AS existing_companion
                      WHERE existing_companion."parent_voice_space_id" =
                            voice."id"
                  );

                UPDATE "space_messages" AS sm
                SET "space_id" = companion."id"
                FROM "spaces" AS companion
                WHERE companion."parent_voice_space_id" = sm."space_id";

                UPDATE "space_read_states" AS srs
                SET "space_id" = companion."id"
                FROM "spaces" AS companion
                WHERE companion."parent_voice_space_id" = srs."space_id";

                UPDATE "space_pinned_messages" AS spm
                SET "space_id" = companion."id"
                FROM "spaces" AS companion
                WHERE companion."parent_voice_space_id" = spm."space_id";

                UPDATE "moderation_cases" AS mc
                SET "space_id" = companion."id"
                FROM "spaces" AS companion
                WHERE companion."parent_voice_space_id" = mc."space_id";
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_PresenceVisibility",
                table: "user_profile_settings",
                sql: "presence_visibility IN ('everyone', 'friends', 'nobody') OR presence_visibility LIKE 'custom:%'");

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_ParentVoiceSpace_Unique",
                table: "spaces",
                column: "parent_voice_space_id",
                unique: true,
                filter: "parent_voice_space_id IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_spaces_spaces_parent_voice_space_id",
                table: "spaces",
                column: "parent_voice_space_id",
                principalTable: "spaces",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                LOCK TABLE
                    "spaces",
                    "space_messages",
                    "space_read_states",
                    "space_pinned_messages",
                    "moderation_cases"
                IN SHARE ROW EXCLUSIVE MODE;

                UPDATE "moderation_cases" AS mc
                SET "space_id" = companion."parent_voice_space_id"
                FROM "spaces" AS companion
                WHERE mc."space_id" = companion."id"
                  AND companion."parent_voice_space_id" IS NOT NULL;

                UPDATE "space_pinned_messages" AS spm
                SET "space_id" = companion."parent_voice_space_id"
                FROM "spaces" AS companion
                WHERE spm."space_id" = companion."id"
                  AND companion."parent_voice_space_id" IS NOT NULL;

                UPDATE "space_read_states" AS srs
                SET "space_id" = companion."parent_voice_space_id"
                FROM "spaces" AS companion
                WHERE srs."space_id" = companion."id"
                  AND companion."parent_voice_space_id" IS NOT NULL;

                UPDATE "space_messages" AS sm
                SET "space_id" = companion."parent_voice_space_id"
                FROM "spaces" AS companion
                WHERE sm."space_id" = companion."id"
                  AND companion."parent_voice_space_id" IS NOT NULL;

                DELETE FROM "spaces"
                WHERE "parent_voice_space_id" IS NOT NULL;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_spaces_spaces_parent_voice_space_id",
                table: "spaces");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_PresenceVisibility",
                table: "user_profile_settings");

            migrationBuilder.DropIndex(
                name: "IX_Spaces_ParentVoiceSpace_Unique",
                table: "spaces");

            migrationBuilder.DropColumn(
                name: "parent_voice_space_id",
                table: "spaces");

            migrationBuilder.Sql(
                """
                UPDATE "user_profile_settings"
                SET "presence_visibility" = 'nobody'
                WHERE "presence_visibility" LIKE 'custom:%';
                """);

            migrationBuilder.AlterColumn<string>(
                name: "presence_visibility",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "everyone",
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldDefaultValue: "everyone");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_PresenceVisibility",
                table: "user_profile_settings",
                sql: "presence_visibility IN ('everyone', 'friends', 'nobody')");
        }
    }
}
