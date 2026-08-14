using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileBackgroundSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "profile_background_asset_id",
                table: "user_profile_settings",
                type: "uuid",
                nullable: true);

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "code", "is_user_upload", "title" },
                values: new object[] { new Guid("16000000-0000-0000-0000-000000000000"), "profile_background", true, "Profile background" });

            migrationBuilder.CreateIndex(
                name: "IX_user_profile_settings_profile_background_asset_id",
                table: "user_profile_settings",
                column: "profile_background_asset_id");

            migrationBuilder.AddForeignKey(
                name: "FK_user_profile_settings_assets_profile_background_asset_id",
                table: "user_profile_settings",
                column: "profile_background_asset_id",
                principalTable: "assets",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_profile_settings_assets_profile_background_asset_id",
                table: "user_profile_settings");

            migrationBuilder.DropIndex(
                name: "IX_user_profile_settings_profile_background_asset_id",
                table: "user_profile_settings");

            migrationBuilder.DeleteData(
                table: "asset_types",
                keyColumn: "id",
                keyValue: new Guid("16000000-0000-0000-0000-000000000000"));

            migrationBuilder.DropColumn(
                name: "profile_background_asset_id",
                table: "user_profile_settings");
        }
    }
}
