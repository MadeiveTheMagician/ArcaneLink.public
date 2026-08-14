using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddAssets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "asset_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    is_user_upload = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    asset_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    storage_key = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    mime_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    sha256 = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assets", x => x.id);
                    table.ForeignKey(
                        name: "FK_assets_asset_types_asset_type_id",
                        column: x => x.asset_type_id,
                        principalTable: "asset_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_assets_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.InsertData(
                table: "asset_types",
                columns: new[] { "id", "code", "is_user_upload", "title" },
                values: new object[,]
                {
                    { new Guid("11000000-0000-0000-0000-000000000000"), "avatar", true, "Avatar" },
                    { new Guid("12000000-0000-0000-0000-000000000000"), "banner", true, "Banner" },
                    { new Guid("13000000-0000-0000-0000-000000000000"), "message_attachment", true, "Message attachment" },
                    { new Guid("14000000-0000-0000-0000-000000000000"), "server_icon", true, "Server icon" },
                    { new Guid("15000000-0000-0000-0000-000000000000"), "game_avatar", true, "Game avatar" },
                    { new Guid("19000000-0000-0000-0000-000000000000"), "other", true, "Other" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_profiles_avatar_asset_id",
                table: "user_profiles",
                column: "avatar_asset_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_profiles_banner_asset_id",
                table: "user_profiles",
                column: "banner_asset_id");

            migrationBuilder.CreateIndex(
                name: "UX_AssetTypes_Code",
                table: "asset_types",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Assets_Owner_Time",
                table: "assets",
                columns: new[] { "owner_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_Assets_Sha256",
                table: "assets",
                column: "sha256");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_Type_Time",
                table: "assets",
                columns: new[] { "asset_type_id", "created_at" });

            migrationBuilder.AddForeignKey(
                name: "FK_user_profiles_assets_avatar_asset_id",
                table: "user_profiles",
                column: "avatar_asset_id",
                principalTable: "assets",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_user_profiles_assets_banner_asset_id",
                table: "user_profiles",
                column: "banner_asset_id",
                principalTable: "assets",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_profiles_assets_avatar_asset_id",
                table: "user_profiles");

            migrationBuilder.DropForeignKey(
                name: "FK_user_profiles_assets_banner_asset_id",
                table: "user_profiles");

            migrationBuilder.DropTable(
                name: "assets");

            migrationBuilder.DropTable(
                name: "asset_types");

            migrationBuilder.DropIndex(
                name: "IX_user_profiles_avatar_asset_id",
                table: "user_profiles");

            migrationBuilder.DropIndex(
                name: "IX_user_profiles_banner_asset_id",
                table: "user_profiles");
        }
    }
}
