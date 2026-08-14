using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemThemesAndProfileThemeSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "apply_system_theme_to_other_profiles",
                table: "user_profile_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "profile_color",
                table: "user_profile_settings",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "selected_theme_id",
                table: "user_profile_settings",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("41000000-0000-0000-0000-000000000001"));

            migrationBuilder.CreateTable(
                name: "system_themes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    dominant_color = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    css_variables_json = table.Column<string>(type: "jsonb", nullable: false, defaultValue: "{}"),
                    is_default = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    display_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_themes", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "system_themes",
                columns: new[] { "id", "code", "css_variables_json", "display_order", "dominant_color", "is_default", "title" },
                values: new object[] { new Guid("41000000-0000-0000-0000-000000000001"), "sapphire", "{\"--color-bg\":\"#0b1020\",\"--color-text\":\"#e6e9f5\",\"--color-muted\":\"#a0a6c7\",\"--color-accent\":\"#7b61ff\"}", 0, "#7b61ff", true, "Сапфировая" });

            migrationBuilder.InsertData(
                table: "system_themes",
                columns: new[] { "id", "code", "css_variables_json", "display_order", "dominant_color", "title" },
                values: new object[,]
                {
                    { new Guid("41000000-0000-0000-0000-000000000002"), "ivory", "{\"--color-bg\":\"#fbf6ea\",\"--color-text\":\"#2d261a\",\"--color-muted\":\"#786a54\",\"--color-accent\":\"#b68d4c\"}", 1, "#f4ead2", "Белая айвори" },
                    { new Guid("41000000-0000-0000-0000-000000000003"), "gray", "{\"--color-bg\":\"#171a20\",\"--color-text\":\"#eef1f5\",\"--color-muted\":\"#aeb6c2\",\"--color-accent\":\"#8f98a8\"}", 2, "#8f98a8", "Серая" },
                    { new Guid("41000000-0000-0000-0000-000000000004"), "sky", "{\"--color-bg\":\"#061725\",\"--color-text\":\"#e8f7ff\",\"--color-muted\":\"#99c7df\",\"--color-accent\":\"#54b8ff\"}", 3, "#54b8ff", "Голубая" },
                    { new Guid("41000000-0000-0000-0000-000000000005"), "black", "{\"--color-bg\":\"#050507\",\"--color-text\":\"#f1f1f3\",\"--color-muted\":\"#a5a6ad\",\"--color-accent\":\"#f0f0f0\"}", 4, "#101116", "Чёрная" },
                    { new Guid("41000000-0000-0000-0000-000000000006"), "pink", "{\"--color-bg\":\"#25101d\",\"--color-text\":\"#fff0f7\",\"--color-muted\":\"#d6a2bd\",\"--color-accent\":\"#ff77ba\"}", 5, "#ff77ba", "Розовая" },
                    { new Guid("41000000-0000-0000-0000-000000000007"), "green-apple", "{\"--color-bg\":\"#0f2111\",\"--color-text\":\"#f2ffe9\",\"--color-muted\":\"#add09c\",\"--color-accent\":\"#8ee957\"}", 6, "#8ee957", "Зелёное яблоко" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_profile_settings_selected_theme_id",
                table: "user_profile_settings",
                column: "selected_theme_id");

            migrationBuilder.CreateIndex(
                name: "UX_SystemThemes_Code",
                table: "system_themes",
                column: "code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_user_profile_settings_system_themes_selected_theme_id",
                table: "user_profile_settings",
                column: "selected_theme_id",
                principalTable: "system_themes",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_profile_settings_system_themes_selected_theme_id",
                table: "user_profile_settings");

            migrationBuilder.DropTable(
                name: "system_themes");

            migrationBuilder.DropIndex(
                name: "IX_user_profile_settings_selected_theme_id",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "apply_system_theme_to_other_profiles",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "profile_color",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "selected_theme_id",
                table: "user_profile_settings");
        }
    }
}
