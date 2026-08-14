using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerCore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "server_member_statuses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_member_statuses", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "servers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    title = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    description = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    icon_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_public = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    is_system = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_servers", x => x.id);
                    table.ForeignKey(
                        name: "FK_servers_assets_icon_asset_id",
                        column: x => x.icon_asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_servers_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_servers_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "server_members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status_id = table.Column<Guid>(type: "uuid", nullable: false),
                    joined_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    left_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    added_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_members", x => x.id);
                    table.ForeignKey(
                        name: "FK_server_members_server_member_statuses_status_id",
                        column: x => x.status_id,
                        principalTable: "server_member_statuses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_members_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_members_users_added_by_user_id",
                        column: x => x.added_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_members_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "server_member_statuses",
                columns: new[] { "id", "code", "title" },
                values: new object[,]
                {
                    { new Guid("40000000-0000-0000-0000-000000000000"), "active", "Active" },
                    { new Guid("50000000-0000-0000-0000-000000000000"), "left", "Left" },
                    { new Guid("60000000-0000-0000-0000-000000000000"), "removed", "Removed" },
                    { new Guid("70000000-0000-0000-0000-000000000000"), "banned", "Banned" }
                });

            migrationBuilder.CreateIndex(
                name: "UX_ServerMemberStatuses_Code",
                table: "server_member_statuses",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerMembers_Server_Status_Time",
                table: "server_members",
                columns: new[] { "server_id", "status_id", "joined_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerMembers_User_Status_Time",
                table: "server_members",
                columns: new[] { "user_id", "status_id", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "IX_server_members_added_by_user_id",
                table: "server_members",
                column: "added_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_members_status_id",
                table: "server_members",
                column: "status_id");

            migrationBuilder.CreateIndex(
                name: "UX_ServerMembers_Server_Id",
                table: "server_members",
                columns: new[] { "server_id", "id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ServerMembers_Server_User",
                table: "server_members",
                columns: new[] { "server_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Servers_Creator_Time",
                table: "servers",
                columns: new[] { "created_by_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_Servers_Owner_Time",
                table: "servers",
                columns: new[] { "owner_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_servers_icon_asset_id",
                table: "servers",
                column: "icon_asset_id");

            migrationBuilder.CreateIndex(
                name: "UX_Servers_Slug",
                table: "servers",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "server_members");

            migrationBuilder.DropTable(
                name: "server_member_statuses");

            migrationBuilder.DropTable(
                name: "servers");
        }
    }
}
