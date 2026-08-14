using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUserFriends : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "friend_request_statuses",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_friend_request_statuses", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "friend_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    to_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_friend_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_friend_requests_friend_request_statuses_status_id",
                        column: x => x.status_id,
                        principalTable: "friend_request_statuses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_friend_requests_users_from_user_id",
                        column: x => x.from_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_friend_requests_users_to_user_id",
                        column: x => x.to_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_friends",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    friend_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_friends", x => new { x.user_id, x.friend_user_id });
                    table.ForeignKey(
                        name: "FK_user_friends_friend_requests_created_by_request_id",
                        column: x => x.created_by_request_id,
                        principalTable: "friend_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_user_friends_users_friend_user_id",
                        column: x => x.friend_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_friends_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "friend_request_statuses",
                columns: new[] { "id", "code", "title" },
                values: new object[,]
                {
                    { new Guid("31000000-0000-0000-0000-000000000001"), "pending", "Pending" },
                    { new Guid("31000000-0000-0000-0000-000000000002"), "accepted", "Accepted" },
                    { new Guid("31000000-0000-0000-0000-000000000003"), "declined", "Declined" },
                    { new Guid("31000000-0000-0000-0000-000000000004"), "canceled", "Canceled" }
                });

            migrationBuilder.CreateIndex(
                name: "UX_FriendRequestStatuses_Code",
                table: "friend_request_statuses",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FriendRequests_From_Status_Time",
                table: "friend_requests",
                columns: new[] { "from_user_id", "status_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_FriendRequests_From_To_Status",
                table: "friend_requests",
                columns: new[] { "from_user_id", "to_user_id", "status_id" });

            migrationBuilder.CreateIndex(
                name: "IX_FriendRequests_To_Status_Time",
                table: "friend_requests",
                columns: new[] { "to_user_id", "status_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_friend_requests_status_id",
                table: "friend_requests",
                column: "status_id");

            migrationBuilder.CreateIndex(
                name: "IX_UserFriends_Friend_User",
                table: "user_friends",
                columns: new[] { "friend_user_id", "user_id" });

            migrationBuilder.CreateIndex(
                name: "IX_UserFriends_Request",
                table: "user_friends",
                column: "created_by_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_UserFriends_User_Time",
                table: "user_friends",
                columns: new[] { "user_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_friends");

            migrationBuilder.DropTable(
                name: "friend_requests");

            migrationBuilder.DropTable(
                name: "friend_request_statuses");
        }
    }
}
