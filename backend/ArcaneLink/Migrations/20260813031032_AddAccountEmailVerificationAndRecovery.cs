using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountEmailVerificationAndRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "email_confirmed_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE users SET email_confirmed_at = COALESCE(updated_at, created_at) WHERE email_confirmed_at IS NULL;");

            migrationBuilder.CreateTable(
                name: "email_outbox_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    protected_payload = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    available_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    lease_id = table.Column<Guid>(type: "uuid", nullable: true),
                    lease_expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    processed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    dead_lettered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_outbox_messages", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_account_action_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    token_hash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    pending_value = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    consumed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_account_action_tokens", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_account_action_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "user_statuses",
                columns: new[] { "id", "code", "title" },
                values: new object[] { new Guid("40000000-0000-0000-0000-000000000000"), "pending_email_verification", "Pending email verification" });

            migrationBuilder.CreateIndex(
                name: "IX_EmailOutboxMessages_Dispatch",
                table: "email_outbox_messages",
                columns: new[] { "processed_at", "dead_lettered_at", "available_at", "lease_expires_at" });

            migrationBuilder.CreateIndex(
                name: "IX_UserAccountActionTokens_ExpiresAt",
                table: "user_account_action_tokens",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "IX_UserAccountActionTokens_User_Purpose_Consumed",
                table: "user_account_action_tokens",
                columns: new[] { "user_id", "purpose", "consumed_at" });

            migrationBuilder.CreateIndex(
                name: "UX_UserAccountActionTokens_TokenHash",
                table: "user_account_action_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_UserAccountActionTokens_User_Purpose_Active",
                table: "user_account_action_tokens",
                columns: new[] { "user_id", "purpose" },
                unique: true,
                filter: "consumed_at IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_outbox_messages");

            migrationBuilder.DropTable(
                name: "user_account_action_tokens");

            migrationBuilder.Sql(
                "UPDATE users SET status_id = '10000000-0000-0000-0000-000000000000' WHERE status_id = '40000000-0000-0000-0000-000000000000';");

            migrationBuilder.DeleteData(
                table: "user_statuses",
                keyColumn: "id",
                keyValue: new Guid("40000000-0000-0000-0000-000000000000"));

            migrationBuilder.DropColumn(
                name: "email_confirmed_at",
                table: "users");
        }
    }
}
