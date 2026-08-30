using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddCurrentAvatarAssetType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "code", "is_user_upload", "title" },
                values: new object[] { new Guid("17000000-0000-0000-0000-000000000000"), "avatar_current", false, "Current optimized avatar" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("17000000-0000-0000-0000-000000000000"));
        }
    }
}
