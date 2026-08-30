using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerMemberProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "server_member_profiles",
                columns: table => new
                {
                    server_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    display_name_norm = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    avatar_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    avatar_source_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    avatar_crop_offset_x = table.Column<double>(type: "double precision", nullable: false, defaultValue: 0.0),
                    avatar_crop_offset_y = table.Column<double>(type: "double precision", nullable: false, defaultValue: 0.0),
                    avatar_crop_zoom = table.Column<double>(type: "double precision", nullable: false, defaultValue: 1.0),
                    banner_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    about = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    status_text = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_member_profiles", x => x.server_member_id);
                    table.ForeignKey(
                        name: "FK_server_member_profiles_assets_avatar_asset_id",
                        column: x => x.avatar_asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_server_member_profiles_assets_avatar_source_asset_id",
                        column: x => x.avatar_source_asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_server_member_profiles_assets_banner_asset_id",
                        column: x => x.banner_asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_server_member_profiles_server_members_server_member_id",
                        column: x => x.server_member_id,
                        principalTable: "server_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServerMemberProfiles_DisplayNameNorm",
                table: "server_member_profiles",
                column: "display_name_norm");

            migrationBuilder.CreateIndex(
                name: "IX_server_member_profiles_avatar_asset_id",
                table: "server_member_profiles",
                column: "avatar_asset_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_member_profiles_avatar_source_asset_id",
                table: "server_member_profiles",
                column: "avatar_source_asset_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_member_profiles_banner_asset_id",
                table: "server_member_profiles",
                column: "banner_asset_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "server_member_profiles");
        }
    }
}
