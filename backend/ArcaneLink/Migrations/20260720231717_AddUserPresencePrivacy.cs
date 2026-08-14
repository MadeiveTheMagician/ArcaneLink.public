using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPresencePrivacy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "presence_mode",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "automatic");

            migrationBuilder.AddColumn<string>(
                name: "presence_visibility",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "everyone");

            migrationBuilder.AddColumn<bool>(
                name: "show_last_seen",
                table: "user_profile_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_PresenceMode",
                table: "user_profile_settings",
                sql: "presence_mode IN ('automatic', 'invisible')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_UserProfileSettings_PresenceVisibility",
                table: "user_profile_settings",
                sql: "presence_visibility IN ('everyone', 'friends', 'nobody')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_PresenceMode",
                table: "user_profile_settings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_UserProfileSettings_PresenceVisibility",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "presence_mode",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "presence_visibility",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "show_last_seen",
                table: "user_profile_settings");
        }
    }
}
