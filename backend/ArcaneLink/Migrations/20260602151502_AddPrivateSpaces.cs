using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateSpaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "private_space_member_statuses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_private_space_member_statuses", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "private_spaces",
                columns: table => new
                {
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    description = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_private_spaces", x => x.space_id);
                    table.ForeignKey(
                        name: "FK_private_spaces_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_private_spaces_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "private_space_members",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_private_space_members", x => x.id);
                    table.ForeignKey(
                        name: "FK_private_space_members_private_space_member_statuses_status_~",
                        column: x => x.status_id,
                        principalTable: "private_space_member_statuses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_private_space_members_private_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "private_spaces",
                        principalColumn: "space_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_private_space_members_users_added_by_user_id",
                        column: x => x.added_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_private_space_members_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "private_space_member_statuses",
                columns: new[] { "id", "code", "title" },
                values: new object[,]
                {
                    { new Guid("26000000-0000-0000-0000-000000000001"), "active", "Active" },
                    { new Guid("26000000-0000-0000-0000-000000000002"), "left", "Left" },
                    { new Guid("26000000-0000-0000-0000-000000000003"), "removed", "Removed" }
                });

            migrationBuilder.CreateIndex(
                name: "UX_PrivateSpaceMemberStatuses_Code",
                table: "private_space_member_statuses",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceMembers_Space_Status_Time",
                table: "private_space_members",
                columns: new[] { "space_id", "status_id", "joined_at" });

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaceMembers_User_Status_Time",
                table: "private_space_members",
                columns: new[] { "user_id", "status_id", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "IX_private_space_members_added_by_user_id",
                table: "private_space_members",
                column: "added_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_private_space_members_status_id",
                table: "private_space_members",
                column: "status_id");

            migrationBuilder.CreateIndex(
                name: "UX_PrivateSpaceMembers_Space_Id",
                table: "private_space_members",
                columns: new[] { "space_id", "id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_PrivateSpaceMembers_Space_User",
                table: "private_space_members",
                columns: new[] { "space_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrivateSpaces_Creator_Time",
                table: "private_spaces",
                columns: new[] { "created_by_user_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "private_space_members");

            migrationBuilder.DropTable(
                name: "private_space_member_statuses");

            migrationBuilder.DropTable(
                name: "private_spaces");
        }
    }
}
