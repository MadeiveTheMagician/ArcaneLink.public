using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateSpaceHistoryOrderingAndUserPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_all_private_space_order_locked",
                table: "user_profile_settings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "private_message_display_format",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "wall-scroll");

            migrationBuilder.AddColumn<string>(
                name: "server_message_display_format",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "wall-scroll");

            migrationBuilder.AddColumn<bool>(
                name: "show_private_read_all_button",
                table: "user_profile_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "comment",
                table: "user_direct_message_blocks",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "hidden_from_list_at",
                table: "private_space_members",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "history_cleared_at",
                table: "private_space_members",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "list_activity_at",
                table: "private_space_members",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_order_locked",
                table: "private_space_folders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "activity_at",
                table: "private_space_folder_items",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE private_space_members
                SET list_activity_at = COALESCE(updated_at, joined_at, created_at, NOW())
                WHERE list_activity_at IS NULL;
                """);

            migrationBuilder.Sql(
                """
                UPDATE private_space_folder_items
                SET activity_at = COALESCE(created_at, NOW())
                WHERE activity_at IS NULL;
                """);

            migrationBuilder.AlterColumn<DateTime>(
                name: "list_activity_at",
                table: "private_space_members",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTime>(
                name: "activity_at",
                table: "private_space_folder_items",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_PrivateMessageDisplayFormat",
                table: "user_profile_settings",
                sql: "private_message_display_format IN ('wall-scroll', 'bubble')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_ServerMessageDisplayFormat",
                table: "user_profile_settings",
                sql: "server_message_display_format IN ('wall-scroll', 'bubble')");

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceMembers_User_Status_Visibility_Activity",
                table: "private_space_members",
                columns: new[] { "user_id", "status_id", "hidden_from_list_at", "list_activity_at" });

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceFolderItems_Folder_Activity",
                table: "private_space_folder_items",
                columns: new[] { "folder_id", "pinned_at", "activity_at", "position" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_PrivateMessageDisplayFormat",
                table: "user_profile_settings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_ServerMessageDisplayFormat",
                table: "user_profile_settings");

            migrationBuilder.DropIndex(
                name: "IX_PrivateSpaceMembers_User_Status_Visibility_Activity",
                table: "private_space_members");

            migrationBuilder.DropIndex(
                name: "IX_PrivateSpaceFolderItems_Folder_Activity",
                table: "private_space_folder_items");

            migrationBuilder.DropColumn(
                name: "is_all_private_space_order_locked",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "private_message_display_format",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "server_message_display_format",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "show_private_read_all_button",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "comment",
                table: "user_direct_message_blocks");

            migrationBuilder.DropColumn(
                name: "hidden_from_list_at",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "history_cleared_at",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "list_activity_at",
                table: "private_space_members");

            migrationBuilder.DropColumn(
                name: "is_order_locked",
                table: "private_space_folders");

            migrationBuilder.DropColumn(
                name: "activity_at",
                table: "private_space_folder_items");
        }
    }
}
