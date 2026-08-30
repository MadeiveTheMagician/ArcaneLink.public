using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddSpaceMessages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "space_message_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_message_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "space_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sender_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    message_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    body = table.Column<string>(type: "text", nullable: true),
                    payload = table.Column<string>(type: "jsonb", nullable: true),
                    reply_to_message_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    edited_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_messages", x => x.id);
                    table.ForeignKey(
                        name: "FK_space_messages_space_message_types_message_type_id",
                        column: x => x.message_type_id,
                        principalTable: "space_message_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_messages_space_messages_reply_to_message_id",
                        column: x => x.reply_to_message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_messages_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_space_messages_users_sender_user_id",
                        column: x => x.sender_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "space_message_assets",
                columns: table => new
                {
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_message_assets", x => new { x.message_id, x.asset_id });
                    table.ForeignKey(
                        name: "FK_space_message_assets_assets_asset_id",
                        column: x => x.asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_message_assets_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "space_message_reactions",
                columns: table => new
                {
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    emoji_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_message_reactions", x => new { x.message_id, x.user_id, x.emoji_code });
                    table.ForeignKey(
                        name: "FK_space_message_reactions_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_space_message_reactions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "space_pinned_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pinned_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pinned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    unpinned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    unpinned_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_pinned_messages", x => x.id);
                    table.ForeignKey(
                        name: "FK_space_pinned_messages_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_space_pinned_messages_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_space_pinned_messages_users_pinned_by_user_id",
                        column: x => x.pinned_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_pinned_messages_users_unpinned_by_user_id",
                        column: x => x.unpinned_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "space_message_types",
                columns: new[] { "id", "code", "title" },
                values: new object[,]
                {
                    { new Guid("25000000-0000-0000-0000-000000000101"), "text", "Text" },
                    { new Guid("25000000-0000-0000-0000-000000000102"), "system", "System" },
                    { new Guid("25000000-0000-0000-0000-000000000103"), "media", "Media" },
                    { new Guid("25000000-0000-0000-0000-000000000104"), "event", "Event" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessageAssets_Asset_Message",
                table: "space_message_assets",
                columns: new[] { "asset_id", "message_id" });

            migrationBuilder.CreateIndex(
                name: "UX_SpaceMessageAssets_Message_Asset",
                table: "space_message_assets",
                columns: new[] { "message_id", "asset_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessageReactions_Message_Emoji_Time",
                table: "space_message_reactions",
                columns: new[] { "message_id", "emoji_code", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessageReactions_User_Time",
                table: "space_message_reactions",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "UX_SpaceMessageReactions_Message_User_Emoji",
                table: "space_message_reactions",
                columns: new[] { "message_id", "user_id", "emoji_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_SpaceMessageTypes_Code",
                table: "space_message_types",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_ReplyTo",
                table: "space_messages",
                column: "reply_to_message_id");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_Sender_Time",
                table: "space_messages",
                columns: new[] { "sender_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceMessages_Space_Time",
                table: "space_messages",
                columns: new[] { "space_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_space_messages_message_type_id",
                table: "space_messages",
                column: "message_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_SpacePinnedMessages_Space_Time",
                table: "space_pinned_messages",
                columns: new[] { "space_id", "pinned_at" });

            migrationBuilder.CreateIndex(
                name: "IX_space_pinned_messages_message_id",
                table: "space_pinned_messages",
                column: "message_id");

            migrationBuilder.CreateIndex(
                name: "IX_space_pinned_messages_pinned_by_user_id",
                table: "space_pinned_messages",
                column: "pinned_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_space_pinned_messages_unpinned_by_user_id",
                table: "space_pinned_messages",
                column: "unpinned_by_user_id");

            migrationBuilder.CreateIndex(
                name: "UX_SpacePinnedMessages_Space_Message",
                table: "space_pinned_messages",
                columns: new[] { "space_id", "message_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "space_message_assets");

            migrationBuilder.DropTable(
                name: "space_message_reactions");

            migrationBuilder.DropTable(
                name: "space_pinned_messages");

            migrationBuilder.DropTable(
                name: "space_messages");

            migrationBuilder.DropTable(
                name: "space_message_types");
        }
    }
}
