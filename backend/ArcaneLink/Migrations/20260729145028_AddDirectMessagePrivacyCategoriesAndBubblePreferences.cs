using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddDirectMessagePrivacyCategoriesAndBubblePreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_DirectMessagePermission",
                table: "user_profile_settings");

            migrationBuilder.AlterColumn<string>(
                name: "direct_message_permission",
                table: "user_profile_settings",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "everyone",
                oldClrType: typeof(string),
                oldType: "character varying(24)",
                oldMaxLength: 24,
                oldDefaultValue: "everyone");

            migrationBuilder.AddColumn<string>(
                name: "private_message_bubble_alignment",
                table: "user_profile_settings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "own-right");

            migrationBuilder.AddColumn<string>(
                name: "private_message_bubble_width",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "standard");

            migrationBuilder.AddColumn<string>(
                name: "server_message_bubble_alignment",
                table: "user_profile_settings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "own-right");

            migrationBuilder.AddColumn<string>(
                name: "server_message_bubble_width",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "standard");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_DirectMessagePermission",
                table: "user_profile_settings",
                sql: "direct_message_permission IN ('everyone', 'friends', 'shared_servers', 'nobody') OR direct_message_permission LIKE 'custom:%'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_PrivateMessageBubbleAlignment",
                table: "user_profile_settings",
                sql: "private_message_bubble_alignment IN ('one-side-left', 'one-side-right', 'own-left', 'own-right')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_PrivateMessageBubbleWidth",
                table: "user_profile_settings",
                sql: "private_message_bubble_width IN ('standard', 'full-width')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_ServerMessageBubbleAlignment",
                table: "user_profile_settings",
                sql: "server_message_bubble_alignment IN ('one-side-left', 'one-side-right', 'own-left', 'own-right')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_ServerMessageBubbleWidth",
                table: "user_profile_settings",
                sql: "server_message_bubble_width IN ('standard', 'full-width')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_DirectMessagePermission",
                table: "user_profile_settings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_PrivateMessageBubbleAlignment",
                table: "user_profile_settings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_PrivateMessageBubbleWidth",
                table: "user_profile_settings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_ServerMessageBubbleAlignment",
                table: "user_profile_settings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_ServerMessageBubbleWidth",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "private_message_bubble_alignment",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "private_message_bubble_width",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "server_message_bubble_alignment",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "server_message_bubble_width",
                table: "user_profile_settings");

            migrationBuilder.AlterColumn<string>(
                name: "direct_message_permission",
                table: "user_profile_settings",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "everyone",
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64,
                oldDefaultValue: "everyone");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_DirectMessagePermission",
                table: "user_profile_settings",
                sql: "direct_message_permission IN ('everyone', 'friends', 'shared_servers', 'nobody')");
        }
    }
}
