using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class NeutralizeGraphiteSystemThemePalette : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "system_themes",
                keyColumn: "id",
                keyValue: new Guid("41000000-0000-0000-0000-000000000008"),
                columns: new[] { "css_variables_json", "dominant_color" },
                values: new object[] { "{\"--color-bg\":\"#121212\",\"--color-text\":\"#f2f2f2\",\"--color-muted\":\"#b8b8b8\",\"--color-accent\":\"#666666\"}", "#313131" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "system_themes",
                keyColumn: "id",
                keyValue: new Guid("41000000-0000-0000-0000-000000000008"),
                columns: new[] { "css_variables_json", "dominant_color" },
                values: new object[] { "{\"--color-bg\":\"#111214\",\"--color-text\":\"#f2f3f5\",\"--color-muted\":\"#b5bac1\",\"--color-accent\":\"#5f6dcc\"}", "#313338" });
        }
    }
}
