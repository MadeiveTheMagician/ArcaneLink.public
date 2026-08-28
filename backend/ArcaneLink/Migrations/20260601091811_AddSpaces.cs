using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddSpaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "related_space_id",
                table: "server_audit_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "space_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "spaces",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_space_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    description = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    required_server_role_id = table.Column<Guid>(type: "uuid", nullable: true),
                    position = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    is_system = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_spaces", x => x.id);
                    table.ForeignKey(
                        name: "FK_spaces_server_roles_required_server_role_id",
                        column: x => x.required_server_role_id,
                        principalTable: "server_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_spaces_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_spaces_space_types_type_id",
                        column: x => x.type_id,
                        principalTable: "space_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_spaces_spaces_parent_space_id",
                        column: x => x.parent_space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_spaces_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "space_permission_overrides",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    space_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: true),
                    member_id = table.Column<Guid>(type: "uuid", nullable: true),
                    permission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    allow = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    deny = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_space_permission_overrides", x => x.id);
                    table.CheckConstraint("CK_SpacePermissionOverrides_Effect", "allow <> deny");
                    table.CheckConstraint("CK_SpacePermissionOverrides_Target", "(role_id IS NOT NULL AND member_id IS NULL) OR (role_id IS NULL AND member_id IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_space_permission_overrides_permission_catalog_permission_id",
                        column: x => x.permission_id,
                        principalTable: "permission_catalog",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_permission_overrides_server_members_member_id",
                        column: x => x.member_id,
                        principalTable: "server_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_permission_overrides_server_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "server_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_space_permission_overrides_spaces_space_id",
                        column: x => x.space_id,
                        principalTable: "spaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "server_audit_event_types",
                columns: new[] { "id", "code", "description", "title" },
                values: new object[,]
                {
                    { new Guid("24000000-0000-0000-0000-000000000311"), "space_created", null, "Space created" },
                    { new Guid("24000000-0000-0000-0000-000000000312"), "space_updated", null, "Space updated" },
                    { new Guid("24000000-0000-0000-0000-000000000313"), "space_deleted", null, "Space deleted" },
                    { new Guid("24000000-0000-0000-0000-000000000314"), "spaces_reordered", null, "Spaces reordered" },
                    { new Guid("24000000-0000-0000-0000-000000000315"), "space_override_upserted", null, "Space override upserted" },
                    { new Guid("24000000-0000-0000-0000-000000000316"), "space_override_deleted", null, "Space override deleted" }
                });

            migrationBuilder.InsertData(
                table: "space_types",
                columns: new[] { "id", "code", "created_at", "description", "title" },
                values: new object[,]
                {
                    { new Guid("25000000-0000-0000-0000-000000000001"), "category", new DateTime(2026, 6, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Organizational container for server spaces.", "Category" },
                    { new Guid("25000000-0000-0000-0000-000000000002"), "text_room", new DateTime(2026, 6, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Text channel inside a server.", "Text room" },
                    { new Guid("25000000-0000-0000-0000-000000000003"), "voice_room", new DateTime(2026, 6, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Voice or video channel inside a server.", "Voice room" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_server_audit_logs_related_space_id",
                table: "server_audit_logs",
                column: "related_space_id");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Member",
                table: "space_permission_overrides",
                columns: new[] { "space_id", "member_id", "permission_id" });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Member_Perm",
                table: "space_permission_overrides",
                columns: new[] { "member_id", "permission_id" });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Role",
                table: "space_permission_overrides",
                columns: new[] { "space_id", "role_id", "permission_id" });

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Role_Perm",
                table: "space_permission_overrides",
                columns: new[] { "role_id", "permission_id" });

            migrationBuilder.CreateIndex(
                name: "IX_space_permission_overrides_permission_id",
                table: "space_permission_overrides",
                column: "permission_id");

            migrationBuilder.CreateIndex(
                name: "UX_SpaceTypes_Code",
                table: "space_types",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Creator_Time",
                table: "spaces",
                columns: new[] { "created_by_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Hierarchy_Position",
                table: "spaces",
                columns: new[] { "server_id", "parent_space_id", "position" });

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Server_Position",
                table: "spaces",
                columns: new[] { "server_id", "position" });

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Server_RequiredRole_Time",
                table: "spaces",
                columns: new[] { "server_id", "required_server_role_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Server_Type_Time",
                table: "spaces",
                columns: new[] { "server_id", "type_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_spaces_parent_space_id",
                table: "spaces",
                column: "parent_space_id");

            migrationBuilder.CreateIndex(
                name: "IX_spaces_required_server_role_id",
                table: "spaces",
                column: "required_server_role_id");

            migrationBuilder.CreateIndex(
                name: "IX_spaces_type_id",
                table: "spaces",
                column: "type_id");

            migrationBuilder.AddForeignKey(
                name: "FK_server_audit_logs_spaces_related_space_id",
                table: "server_audit_logs",
                column: "related_space_id",
                principalTable: "spaces",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_server_audit_logs_spaces_related_space_id",
                table: "server_audit_logs");

            migrationBuilder.DropTable(
                name: "space_permission_overrides");

            migrationBuilder.DropTable(
                name: "spaces");

            migrationBuilder.DropTable(
                name: "space_types");

            migrationBuilder.DropIndex(
                name: "IX_server_audit_logs_related_space_id",
                table: "server_audit_logs");

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000311"));

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000312"));

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000313"));

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000314"));

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000315"));

            migrationBuilder.DeleteData(
                table: "server_audit_event_types",
                keyColumn: "id",
                keyValue: new Guid("24000000-0000-0000-0000-000000000316"));

            migrationBuilder.DropColumn(
                name: "related_space_id",
                table: "server_audit_logs");
        }
    }
}
