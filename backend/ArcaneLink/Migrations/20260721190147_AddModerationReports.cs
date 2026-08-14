using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddModerationReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "moderation_cases",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reported_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_moderation_cases", x => x.id);
                    table.CheckConstraint("CK_ModerationCases_Status", "\"status\" IN ('open', 'in_review', 'resolved', 'dismissed')");
                    table.ForeignKey(
                        name: "FK_moderation_cases_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_moderation_cases_space_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "space_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_moderation_cases_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_moderation_cases_users_reported_user_id",
                        column: x => x.reported_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "moderation_case_actions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    from_status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    to_status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_moderation_case_actions", x => x.id);
                    table.CheckConstraint("CK_ModerationCaseActions_FromStatus", "\"from_status\" IN ('open', 'in_review', 'resolved', 'dismissed')");
                    table.CheckConstraint("CK_ModerationCaseActions_ToStatus", "\"to_status\" IN ('open', 'in_review', 'resolved', 'dismissed')");
                    table.ForeignKey(
                        name: "FK_moderation_case_actions_moderation_cases_case_id",
                        column: x => x.case_id,
                        principalTable: "moderation_cases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_moderation_case_actions_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "moderation_submissions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reporter_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason_code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    details = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_moderation_submissions", x => x.id);
                    table.CheckConstraint("CK_ModerationSubmissions_Reason", "\"reason_code\" IN ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'privacy', 'other')");
                    table.ForeignKey(
                        name: "FK_moderation_submissions_moderation_cases_case_id",
                        column: x => x.case_id,
                        principalTable: "moderation_cases",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_moderation_submissions_users_reporter_user_id",
                        column: x => x.reporter_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "moderation_evidence",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    body_excerpt = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    payload_excerpt = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    canonical_content_sha256 = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    message_created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    message_updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    message_edited_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    captured_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_moderation_evidence", x => x.id);
                    table.ForeignKey(
                        name: "FK_moderation_evidence_moderation_submissions_submission_id",
                        column: x => x.submission_id,
                        principalTable: "moderation_submissions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "moderation_evidence_assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    evidence_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    is_spoiler = table.Column<bool>(type: "boolean", nullable: false),
                    original_file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    mime_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    sha256 = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: false),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    asset_created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_moderation_evidence_assets", x => x.id);
                    table.ForeignKey(
                        name: "FK_moderation_evidence_assets_assets_asset_id",
                        column: x => x.asset_id,
                        principalTable: "assets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_moderation_evidence_assets_moderation_evidence_evidence_id",
                        column: x => x.evidence_id,
                        principalTable: "moderation_evidence",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "permission_catalog",
                columns: new[] { "id", "code", "created_at", "description", "title" },
                values: new object[] { new Guid("24000000-0000-0000-0000-000000000210"), "manage_reports", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Manage reports" });

            migrationBuilder.Sql(
                """
                INSERT INTO server_role_permissions
                    (role_id, permission_id, is_granted, created_at)
                SELECT
                    role.id,
                    '24000000-0000-0000-0000-000000000210'::uuid,
                    TRUE,
                    CURRENT_TIMESTAMP
                FROM server_roles AS role
                WHERE role.code = 'owner'
                  AND role.deleted_at IS NULL
                ON CONFLICT (role_id, permission_id)
                DO UPDATE SET is_granted = TRUE;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ModerationCaseActions_Case_Time",
                table: "moderation_case_actions",
                columns: new[] { "case_id", "created_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_moderation_case_actions_actor_user_id",
                table: "moderation_case_actions",
                column: "actor_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_ModerationCases_ReportedUser_Time",
                table: "moderation_cases",
                columns: new[] { "reported_user_id", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ModerationCases_Server_Cursor",
                table: "moderation_cases",
                columns: new[] { "server_id", "updated_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_moderation_cases_space_id",
                table: "moderation_cases",
                column: "space_id");

            migrationBuilder.CreateIndex(
                name: "UX_ModerationCases_Message",
                table: "moderation_cases",
                column: "message_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ModerationEvidence_Submission",
                table: "moderation_evidence",
                column: "submission_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModerationEvidenceAssets_Asset",
                table: "moderation_evidence_assets",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "UX_ModerationEvidenceAssets_Evidence_Asset",
                table: "moderation_evidence_assets",
                columns: new[] { "evidence_id", "asset_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModerationSubmissions_Reporter_Time",
                table: "moderation_submissions",
                columns: new[] { "reporter_user_id", "submitted_at" });

            migrationBuilder.CreateIndex(
                name: "UX_ModerationSubmissions_Case_Reporter",
                table: "moderation_submissions",
                columns: new[] { "case_id", "reporter_user_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "moderation_case_actions");

            migrationBuilder.DropTable(
                name: "moderation_evidence_assets");

            migrationBuilder.DropTable(
                name: "moderation_evidence");

            migrationBuilder.DropTable(
                name: "moderation_submissions");

            migrationBuilder.DropTable(
                name: "moderation_cases");

            migrationBuilder.Sql(
                """
                DELETE FROM server_role_permissions
                WHERE permission_id = '24000000-0000-0000-0000-000000000210'::uuid;
                """);

            migrationBuilder.DeleteData(
                table: "permission_catalog",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000210"));
        }
    }
}
