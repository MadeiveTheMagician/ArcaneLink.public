using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerGovernance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "permission_catalog",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permission_catalog", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "server_audit_event_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_audit_event_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "server_invite_kinds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_invite_kinds", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "server_ownership_transfer_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_ownership_transfer_types", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "server_roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    level = table.Column<int>(type: "integer", nullable: false),
                    is_system = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_roles", x => x.id);
                    table.ForeignKey(
                        name: "FK_server_roles_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "server_invites",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    target_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    max_uses = table.Column<int>(type: "integer", nullable: true),
                    used_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_invites", x => x.id);
                    table.ForeignKey(
                        name: "FK_server_invites_server_invite_kinds_kind_id",
                        column: x => x.kind_id,
                        principalTable: "server_invite_kinds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_invites_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_invites_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_invites_users_revoked_by_user_id",
                        column: x => x.revoked_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_invites_users_target_user_id",
                        column: x => x.target_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "server_ownership_transfers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    to_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    transfer_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    executed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    transferred_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_ownership_transfers", x => x.id);
                    table.ForeignKey(
                        name: "FK_server_ownership_transfers_server_ownership_transfer_types_~",
                        column: x => x.transfer_type_id,
                        principalTable: "server_ownership_transfer_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_ownership_transfers_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_ownership_transfers_users_executed_by_user_id",
                        column: x => x.executed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_ownership_transfers_users_from_user_id",
                        column: x => x.from_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_ownership_transfers_users_to_user_id",
                        column: x => x.to_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "server_member_roles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_member_roles", x => x.id);
                    table.ForeignKey(
                        name: "FK_server_member_roles_server_members_member_id",
                        column: x => x.member_id,
                        principalTable: "server_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_member_roles_server_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "server_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_member_roles_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_member_roles_users_assigned_by_user_id",
                        column: x => x.assigned_by_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_server_member_roles_users_revoked_by_user_id",
                        column: x => x.revoked_by_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "server_role_permissions",
                columns: table => new
                {
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    permission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_granted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_role_permissions", x => new { x.role_id, x.permission_id });
                    table.ForeignKey(
                        name: "FK_server_role_permissions_permission_catalog_permission_id",
                        column: x => x.permission_id,
                        principalTable: "permission_catalog",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_role_permissions_server_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "server_roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "server_audit_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    server_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    related_role_id = table.Column<Guid>(type: "uuid", nullable: true),
                    related_invite_id = table.Column<Guid>(type: "uuid", nullable: true),
                    payload = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_audit_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_server_audit_logs_server_audit_event_types_event_type_id",
                        column: x => x.event_type_id,
                        principalTable: "server_audit_event_types",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_server_audit_logs_server_invites_related_invite_id",
                        column: x => x.related_invite_id,
                        principalTable: "server_invites",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_server_audit_logs_server_roles_related_role_id",
                        column: x => x.related_role_id,
                        principalTable: "server_roles",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_server_audit_logs_servers_server_id",
                        column: x => x.server_id,
                        principalTable: "servers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_audit_logs_users_actor_user_id",
                        column: x => x.actor_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_server_audit_logs_users_target_user_id",
                        column: x => x.target_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "server_invite_usages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    invite_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_server_invite_usages", x => x.id);
                    table.ForeignKey(
                        name: "FK_server_invite_usages_server_invites_invite_id",
                        column: x => x.invite_id,
                        principalTable: "server_invites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_server_invite_usages_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "permission_catalog",
                columns: new[] { "id", "code", "created_at", "description", "title" },
                values: new object[,]
                {
                    { new Guid("24000000-0000-0000-0000-000000000201"), "manage_server", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Manage server" },
                    { new Guid("24000000-0000-0000-0000-000000000202"), "manage_roles", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Manage roles" },
                    { new Guid("24000000-0000-0000-0000-000000000203"), "manage_invites", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Manage invites" },
                    { new Guid("24000000-0000-0000-0000-000000000204"), "manage_members", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "Manage members" },
                    { new Guid("24000000-0000-0000-0000-000000000205"), "view_audit_log", new DateTime(2026, 5, 14, 0, 0, 0, 0, DateTimeKind.Utc), null, "View audit log" }
                });

            migrationBuilder.InsertData(
                table: "server_audit_event_types",
                columns: new[] { "id", "code", "description", "title" },
                values: new object[,]
                {
                    { new Guid("24000000-0000-0000-0000-000000000301"), "member_joined", null, "Member joined" },
                    { new Guid("24000000-0000-0000-0000-000000000302"), "member_left", null, "Member left" },
                    { new Guid("24000000-0000-0000-0000-000000000303"), "member_removed", null, "Member removed" },
                    { new Guid("24000000-0000-0000-0000-000000000304"), "ownership_transferred", null, "Ownership transferred" },
                    { new Guid("24000000-0000-0000-0000-000000000305"), "invite_created", null, "Invite created" },
                    { new Guid("24000000-0000-0000-0000-000000000306"), "invite_revoked", null, "Invite revoked" },
                    { new Guid("24000000-0000-0000-0000-000000000307"), "role_created", null, "Role created" },
                    { new Guid("24000000-0000-0000-0000-000000000308"), "role_updated", null, "Role updated" },
                    { new Guid("24000000-0000-0000-0000-000000000309"), "role_assigned", null, "Role assigned" },
                    { new Guid("24000000-0000-0000-0000-000000000310"), "role_revoked", null, "Role revoked" }
                });

            migrationBuilder.InsertData(
                table: "server_invite_kinds",
                columns: new[] { "id", "code", "title" },
                values: new object[,]
                {
                    { new Guid("24000000-0000-0000-0000-000000000001"), "link", "Link" },
                    { new Guid("24000000-0000-0000-0000-000000000002"), "direct", "Direct" }
                });

            migrationBuilder.InsertData(
                table: "server_ownership_transfer_types",
                columns: new[] { "id", "code", "title" },
                values: new object[,]
                {
                    { new Guid("24000000-0000-0000-0000-000000000101"), "voluntary", "Voluntary" },
                    { new Guid("24000000-0000-0000-0000-000000000102"), "forced", "Forced" },
                    { new Guid("24000000-0000-0000-0000-000000000103"), "recovery", "Recovery" }
                });

            migrationBuilder.CreateIndex(
                name: "UX_PermissionCatalog_Code",
                table: "permission_catalog",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ServerAuditEventTypes_Code",
                table: "server_audit_event_types",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerAuditLogs_Actor_Time",
                table: "server_audit_logs",
                columns: new[] { "actor_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerAuditLogs_Server_Time",
                table: "server_audit_logs",
                columns: new[] { "server_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerAuditLogs_Target_Time",
                table: "server_audit_logs",
                columns: new[] { "target_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerAuditLogs_Type_Time",
                table: "server_audit_logs",
                columns: new[] { "event_type_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_server_audit_logs_related_invite_id",
                table: "server_audit_logs",
                column: "related_invite_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_audit_logs_related_role_id",
                table: "server_audit_logs",
                column: "related_role_id");

            migrationBuilder.CreateIndex(
                name: "UX_ServerInviteKinds_Code",
                table: "server_invite_kinds",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerInviteUsages_Invite_Time",
                table: "server_invite_usages",
                columns: new[] { "invite_id", "used_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerInviteUsages_User_Time",
                table: "server_invite_usages",
                columns: new[] { "user_id", "used_at" });

            migrationBuilder.CreateIndex(
                name: "UX_ServerInviteUsages_Invite_User",
                table: "server_invite_usages",
                columns: new[] { "invite_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerInvites_Server_Time",
                table: "server_invites",
                columns: new[] { "server_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerInvites_Target_Time",
                table: "server_invites",
                columns: new[] { "target_user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_server_invites_created_by_user_id",
                table: "server_invites",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_invites_kind_id",
                table: "server_invites",
                column: "kind_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_invites_revoked_by_user_id",
                table: "server_invites",
                column: "revoked_by_user_id");

            migrationBuilder.CreateIndex(
                name: "UX_ServerInvites_Code",
                table: "server_invites",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerMemberRoles_Server_Member",
                table: "server_member_roles",
                columns: new[] { "server_id", "member_id" });

            migrationBuilder.CreateIndex(
                name: "IX_ServerMemberRoles_Server_Role",
                table: "server_member_roles",
                columns: new[] { "server_id", "role_id" });

            migrationBuilder.CreateIndex(
                name: "IX_server_member_roles_assigned_by_user_id",
                table: "server_member_roles",
                column: "assigned_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_member_roles_member_id",
                table: "server_member_roles",
                column: "member_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_member_roles_revoked_by_user_id",
                table: "server_member_roles",
                column: "revoked_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_member_roles_role_id",
                table: "server_member_roles",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "UX_ServerMemberRoles_Server_Member_Role",
                table: "server_member_roles",
                columns: new[] { "server_id", "member_id", "role_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ServerOwnershipTransferTypes_Code",
                table: "server_ownership_transfer_types",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerOwnershipTransfers_Server_Time",
                table: "server_ownership_transfers",
                columns: new[] { "server_id", "transferred_at" });

            migrationBuilder.CreateIndex(
                name: "IX_server_ownership_transfers_executed_by_user_id",
                table: "server_ownership_transfers",
                column: "executed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_ownership_transfers_from_user_id",
                table: "server_ownership_transfers",
                column: "from_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_ownership_transfers_to_user_id",
                table: "server_ownership_transfers",
                column: "to_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_ownership_transfers_transfer_type_id",
                table: "server_ownership_transfers",
                column: "transfer_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_ServerRolePermissions_Permission_Role",
                table: "server_role_permissions",
                columns: new[] { "permission_id", "role_id" });

            migrationBuilder.CreateIndex(
                name: "UX_ServerRolePermissions_Role_Permission",
                table: "server_role_permissions",
                columns: new[] { "role_id", "permission_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServerRoles_Server_Level",
                table: "server_roles",
                columns: new[] { "server_id", "level" });

            migrationBuilder.CreateIndex(
                name: "UX_ServerRoles_Server_Code",
                table: "server_roles",
                columns: new[] { "server_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ServerRoles_Server_Id",
                table: "server_roles",
                columns: new[] { "server_id", "id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ServerRoles_Server_Title",
                table: "server_roles",
                columns: new[] { "server_id", "title" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "server_audit_logs");

            migrationBuilder.DropTable(
                name: "server_invite_usages");

            migrationBuilder.DropTable(
                name: "server_member_roles");

            migrationBuilder.DropTable(
                name: "server_ownership_transfers");

            migrationBuilder.DropTable(
                name: "server_role_permissions");

            migrationBuilder.DropTable(
                name: "server_audit_event_types");

            migrationBuilder.DropTable(
                name: "server_invites");

            migrationBuilder.DropTable(
                name: "server_ownership_transfer_types");

            migrationBuilder.DropTable(
                name: "permission_catalog");

            migrationBuilder.DropTable(
                name: "server_roles");

            migrationBuilder.DropTable(
                name: "server_invite_kinds");
        }
    }
}
