using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddGraphiteAndSnowSystemThemes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "system_themes",
                columns: new[] { "id", "code", "css_variables_json", "display_order", "dominant_color", "title" },
                values: new object[,]
                {
                    { new Guid("41000000-0000-0000-0000-000000000008"), "graphite", "{\"--color-bg\":\"#111214\",\"--color-text\":\"#f2f3f5\",\"--color-muted\":\"#b5bac1\",\"--color-accent\":\"#5f6dcc\"}", 7, "#313338", "Графитовая" },
                    { new Guid("41000000-0000-0000-0000-000000000009"), "snow", "{\"--color-bg\":\"#f8fafc\",\"--color-text\":\"#1f2937\",\"--color-muted\":\"#5f6977\",\"--color-accent\":\"#647184\"}", 8, "#e4e7ec", "Снежная" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE user_profile_settings
                SET selected_theme_id = '41000000-0000-0000-0000-000000000001'::uuid
                WHERE selected_theme_id IN (
                    '41000000-0000-0000-0000-000000000008'::uuid,
                    '41000000-0000-0000-0000-000000000009'::uuid
                );
                """);

            migrationBuilder.DeleteData(
                table: "system_themes",
                keyColumn: "id",
                keyValue: new Guid("41000000-0000-0000-0000-000000000008"));

            migrationBuilder.DeleteData(
                table: "system_themes",
                keyColumn: "id",
                keyValue: new Guid("41000000-0000-0000-0000-000000000009"));
        }
    }
}
