using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerAuthorizationMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "created_with_role_id",
                table: "spaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "protection_role_id",
                table: "spaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "version",
                table: "spaces",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_user_id",
                table: "space_permission_overrides",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "protection_role_id",
                table: "space_permission_overrides",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "server_id",
                table: "space_permission_overrides",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "version",
                table: "space_permission_overrides",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<Guid>(
                name: "authorization_version",
                table: "servers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "color",
                table: "server_roles",
                type: "character varying(9)",
                maxLength: 9,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_user_id",
                table: "server_roles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "server_roles",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "standard");

            migrationBuilder.AddColumn<bool>(
                name: "mentionable",
                table: "server_roles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "version",
                table: "server_roles",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<string>(
                name: "display_color_mode",
                table: "server_members",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "auto");

            migrationBuilder.AddColumn<Guid>(
                name: "display_color_role_id",
                table: "server_members",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "roles_version",
                table: "server_members",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.Sql(
                """
                UPDATE "servers"
                SET "authorization_version" = "space_acl_revision";
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "authorization_version",
                table: "servers",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()",
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "space_permission_overrides" AS permission_override
                SET "server_id" = space."server_id"
                FROM "spaces" AS space
                WHERE space."id" = permission_override."space_id";

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM "space_permission_overrides"
                        WHERE "server_id" IS NULL
                    ) THEN
                        RAISE EXCEPTION
                            'Cannot scope space permission overrides whose space is missing or private.';
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "server_id",
                table: "space_permission_overrides",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.Sql(
                """
                WITH role_creators AS (
                    SELECT DISTINCT ON (audit."related_role_id")
                        audit."related_role_id" AS role_id,
                        audit."server_id",
                        actor."id" AS actor_user_id
                    FROM "server_audit_logs" AS audit
                    INNER JOIN "server_audit_event_types" AS event_type
                        ON event_type."id" = audit."event_type_id"
                    INNER JOIN "users" AS actor
                        ON actor."id" = audit."actor_user_id"
                    WHERE event_type."code" = 'role_created'
                      AND audit."related_role_id" IS NOT NULL
                      AND audit."actor_user_id" IS NOT NULL
                    ORDER BY audit."related_role_id", audit."created_at", audit."id"
                )
                UPDATE "server_roles" AS role
                SET "created_by_user_id" = creator."actor_user_id"
                FROM role_creators AS creator
                WHERE creator.role_id = role."id"
                  AND creator."server_id" = role."server_id";
                """);

            migrationBuilder.Sql(
                """
                UPDATE "server_member_roles" AS assignment
                SET "server_id" = member."server_id"
                FROM "server_members" AS member, "server_roles" AS role
                WHERE member."id" = assignment."member_id"
                  AND role."id" = assignment."role_id"
                  AND member."server_id" = role."server_id"
                  AND assignment."server_id" IS DISTINCT FROM member."server_id";

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM "server_member_roles" AS assignment
                        INNER JOIN "server_members" AS member
                            ON member."id" = assignment."member_id"
                        INNER JOIN "server_roles" AS role
                            ON role."id" = assignment."role_id"
                        WHERE assignment."server_id" <> member."server_id"
                           OR assignment."server_id" <> role."server_id"
                    ) THEN
                        RAISE EXCEPTION
                            'Cross-server member role assignments must be repaired before migration.';
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM "spaces" AS space
                        INNER JOIN "server_roles" AS role
                            ON role."id" IN (
                                space."required_server_role_id",
                                space."created_with_role_id",
                                space."protection_role_id")
                        WHERE space."server_id" IS NULL
                           OR space."server_id" <> role."server_id"
                    ) THEN
                        RAISE EXCEPTION
                            'Cross-server space role references must be repaired before migration.';
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM "server_members" AS member
                        INNER JOIN "server_roles" AS role
                            ON role."id" = member."display_color_role_id"
                        WHERE member."server_id" <> role."server_id"
                    ) THEN
                        RAISE EXCEPTION
                            'Cross-server display color role references must be repaired before migration.';
                    END IF;

                    IF EXISTS (
                        SELECT 1
                        FROM "space_permission_overrides" AS permission_override
                        LEFT JOIN "server_roles" AS role
                            ON role."id" = permission_override."role_id"
                        LEFT JOIN "server_members" AS member
                            ON member."id" = permission_override."member_id"
                        LEFT JOIN "server_roles" AS protection_role
                            ON protection_role."id" = permission_override."protection_role_id"
                        WHERE (permission_override."role_id" IS NOT NULL AND
                               (role."id" IS NULL OR
                                permission_override."server_id" <> role."server_id"))
                           OR (permission_override."member_id" IS NOT NULL AND
                               (member."id" IS NULL OR
                                permission_override."server_id" <> member."server_id"))
                           OR (permission_override."protection_role_id" IS NOT NULL AND
                               (protection_role."id" IS NULL OR
                                permission_override."server_id" <> protection_role."server_id"))
                    ) THEN
                        RAISE EXCEPTION
                            'Cross-server permission override targets must be repaired before migration.';
                    END IF;
                END $$;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Server_CreatedWithRole",
                table: "spaces",
                columns: new[] { "server_id", "created_with_role_id" },
                filter: "\"created_with_role_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Server_ProtectionRole",
                table: "spaces",
                columns: new[] { "server_id", "protection_role_id" },
                filter: "\"protection_role_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_spaces_created_with_role_id",
                table: "spaces",
                column: "created_with_role_id");

            migrationBuilder.CreateIndex(
                name: "IX_spaces_protection_role_id",
                table: "spaces",
                column: "protection_role_id");

            migrationBuilder.CreateIndex(
                name: "UX_Spaces_Server_Id",
                table: "spaces",
                columns: new[] { "server_id", "id" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Spaces_ServerRoleScope",
                table: "spaces",
                sql: "\"server_id\" IS NOT NULL OR (\"required_server_role_id\" IS NULL AND \"created_with_role_id\" IS NULL AND \"protection_role_id\" IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Server_ProtectionRole",
                table: "space_permission_overrides",
                columns: new[] { "server_id", "protection_role_id" },
                filter: "\"protection_role_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SpaceOverrides_Server_Space",
                table: "space_permission_overrides",
                columns: new[] { "server_id", "space_id" });

            migrationBuilder.CreateIndex(
                name: "IX_space_permission_overrides_created_by_user_id",
                table: "space_permission_overrides",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_space_permission_overrides_protection_role_id",
                table: "space_permission_overrides",
                column: "protection_role_id");

            migrationBuilder.CreateIndex(
                name: "IX_server_roles_created_by_user_id",
                table: "server_roles",
                column: "created_by_user_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServerRoles_Kind",
                table: "server_roles",
                sql: "\"kind\" IN ('standard', 'everyone', 'integration')");

            migrationBuilder.CreateIndex(
                name: "IX_ServerMembers_Server_DisplayColorRole",
                table: "server_members",
                columns: new[] { "server_id", "display_color_role_id" },
                filter: "\"display_color_role_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_server_members_display_color_role_id",
                table: "server_members",
                column: "display_color_role_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ServerMembers_DisplayColor",
                table: "server_members",
                sql: "(\"display_color_mode\" IN ('auto', 'default') AND \"display_color_role_id\" IS NULL) OR (\"display_color_mode\" = 'role' AND \"display_color_role_id\" IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_server_members_server_roles_display_color_role_id",
                table: "server_members",
                column: "display_color_role_id",
                principalTable: "server_roles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_server_roles_users_created_by_user_id",
                table: "server_roles",
                column: "created_by_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_space_permission_overrides_server_roles_protection_role_id",
                table: "space_permission_overrides",
                column: "protection_role_id",
                principalTable: "server_roles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_space_permission_overrides_servers_server_id",
                table: "space_permission_overrides",
                column: "server_id",
                principalTable: "servers",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_space_permission_overrides_users_created_by_user_id",
                table: "space_permission_overrides",
                column: "created_by_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_spaces_server_roles_created_with_role_id",
                table: "spaces",
                column: "created_with_role_id",
                principalTable: "server_roles",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_spaces_server_roles_protection_role_id",
                table: "spaces",
                column: "protection_role_id",
                principalTable: "server_roles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql(
                """
                ALTER TABLE "server_member_roles"
                    ADD CONSTRAINT "FK_ServerMemberRoles_Server_MemberScope"
                    FOREIGN KEY ("server_id", "member_id")
                    REFERENCES "server_members" ("server_id", "id")
                    ON DELETE CASCADE;

                ALTER TABLE "server_member_roles"
                    ADD CONSTRAINT "FK_ServerMemberRoles_Server_RoleScope"
                    FOREIGN KEY ("server_id", "role_id")
                    REFERENCES "server_roles" ("server_id", "id")
                    ON DELETE CASCADE;

                ALTER TABLE "server_members"
                    ADD CONSTRAINT "FK_ServerMembers_Server_DisplayColorRoleScope"
                    FOREIGN KEY ("server_id", "display_color_role_id")
                    REFERENCES "server_roles" ("server_id", "id");

                ALTER TABLE "spaces"
                    ADD CONSTRAINT "FK_Spaces_Server_RequiredRoleScope"
                    FOREIGN KEY ("server_id", "required_server_role_id")
                    REFERENCES "server_roles" ("server_id", "id");

                ALTER TABLE "spaces"
                    ADD CONSTRAINT "FK_Spaces_Server_CreatedWithRoleScope"
                    FOREIGN KEY ("server_id", "created_with_role_id")
                    REFERENCES "server_roles" ("server_id", "id");

                ALTER TABLE "spaces"
                    ADD CONSTRAINT "FK_Spaces_Server_ProtectionRoleScope"
                    FOREIGN KEY ("server_id", "protection_role_id")
                    REFERENCES "server_roles" ("server_id", "id");

                ALTER TABLE "space_permission_overrides"
                    ADD CONSTRAINT "FK_SpaceOverrides_Server_SpaceScope"
                    FOREIGN KEY ("server_id", "space_id")
                    REFERENCES "spaces" ("server_id", "id")
                    ON DELETE CASCADE;

                ALTER TABLE "space_permission_overrides"
                    ADD CONSTRAINT "FK_SpaceOverrides_Server_RoleScope"
                    FOREIGN KEY ("server_id", "role_id")
                    REFERENCES "server_roles" ("server_id", "id");

                ALTER TABLE "space_permission_overrides"
                    ADD CONSTRAINT "FK_SpaceOverrides_Server_MemberScope"
                    FOREIGN KEY ("server_id", "member_id")
                    REFERENCES "server_members" ("server_id", "id");

                ALTER TABLE "space_permission_overrides"
                    ADD CONSTRAINT "FK_SpaceOverrides_Server_ProtectionRoleScope"
                    FOREIGN KEY ("server_id", "protection_role_id")
                    REFERENCES "server_roles" ("server_id", "id");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "space_permission_overrides"
                    DROP CONSTRAINT IF EXISTS "FK_SpaceOverrides_Server_ProtectionRoleScope";
                ALTER TABLE "space_permission_overrides"
                    DROP CONSTRAINT IF EXISTS "FK_SpaceOverrides_Server_MemberScope";
                ALTER TABLE "space_permission_overrides"
                    DROP CONSTRAINT IF EXISTS "FK_SpaceOverrides_Server_RoleScope";
                ALTER TABLE "space_permission_overrides"
                    DROP CONSTRAINT IF EXISTS "FK_SpaceOverrides_Server_SpaceScope";
                ALTER TABLE "spaces"
                    DROP CONSTRAINT IF EXISTS "FK_Spaces_Server_ProtectionRoleScope";
                ALTER TABLE "spaces"
                    DROP CONSTRAINT IF EXISTS "FK_Spaces_Server_CreatedWithRoleScope";
                ALTER TABLE "spaces"
                    DROP CONSTRAINT IF EXISTS "FK_Spaces_Server_RequiredRoleScope";
                ALTER TABLE "server_members"
                    DROP CONSTRAINT IF EXISTS "FK_ServerMembers_Server_DisplayColorRoleScope";
                ALTER TABLE "server_member_roles"
                    DROP CONSTRAINT IF EXISTS "FK_ServerMemberRoles_Server_RoleScope";
                ALTER TABLE "server_member_roles"
                    DROP CONSTRAINT IF EXISTS "FK_ServerMemberRoles_Server_MemberScope";
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_server_members_server_roles_display_color_role_id",
                table: "server_members");

            migrationBuilder.DropForeignKey(
                name: "FK_server_roles_users_created_by_user_id",
                table: "server_roles");

            migrationBuilder.DropForeignKey(
                name: "FK_space_permission_overrides_server_roles_protection_role_id",
                table: "space_permission_overrides");

            migrationBuilder.DropForeignKey(
                name: "FK_space_permission_overrides_servers_server_id",
                table: "space_permission_overrides");

            migrationBuilder.DropForeignKey(
                name: "FK_space_permission_overrides_users_created_by_user_id",
                table: "space_permission_overrides");

            migrationBuilder.DropForeignKey(
                name: "FK_spaces_server_roles_created_with_role_id",
                table: "spaces");

            migrationBuilder.DropForeignKey(
                name: "FK_spaces_server_roles_protection_role_id",
                table: "spaces");

            migrationBuilder.DropIndex(
                name: "IX_Spaces_Server_CreatedWithRole",
                table: "spaces");

            migrationBuilder.DropIndex(
                name: "IX_Spaces_Server_ProtectionRole",
                table: "spaces");

            migrationBuilder.DropIndex(
                name: "IX_spaces_created_with_role_id",
                table: "spaces");

            migrationBuilder.DropIndex(
                name: "IX_spaces_protection_role_id",
                table: "spaces");

            migrationBuilder.DropIndex(
                name: "UX_Spaces_Server_Id",
                table: "spaces");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Spaces_ServerRoleScope",
                table: "spaces");

            migrationBuilder.DropIndex(
                name: "IX_SpaceOverrides_Server_ProtectionRole",
                table: "space_permission_overrides");

            migrationBuilder.DropIndex(
                name: "IX_SpaceOverrides_Server_Space",
                table: "space_permission_overrides");

            migrationBuilder.DropIndex(
                name: "IX_space_permission_overrides_created_by_user_id",
                table: "space_permission_overrides");

            migrationBuilder.DropIndex(
                name: "IX_space_permission_overrides_protection_role_id",
                table: "space_permission_overrides");

            migrationBuilder.DropIndex(
                name: "IX_server_roles_created_by_user_id",
                table: "server_roles");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ServerRoles_Kind",
                table: "server_roles");

            migrationBuilder.DropIndex(
                name: "IX_ServerMembers_Server_DisplayColorRole",
                table: "server_members");

            migrationBuilder.DropIndex(
                name: "IX_server_members_display_color_role_id",
                table: "server_members");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ServerMembers_DisplayColor",
                table: "server_members");

            migrationBuilder.DropColumn(
                name: "created_with_role_id",
                table: "spaces");

            migrationBuilder.DropColumn(
                name: "protection_role_id",
                table: "spaces");

            migrationBuilder.DropColumn(
                name: "version",
                table: "spaces");

            migrationBuilder.DropColumn(
                name: "created_by_user_id",
                table: "space_permission_overrides");

            migrationBuilder.DropColumn(
                name: "protection_role_id",
                table: "space_permission_overrides");

            migrationBuilder.DropColumn(
                name: "server_id",
                table: "space_permission_overrides");

            migrationBuilder.DropColumn(
                name: "version",
                table: "space_permission_overrides");

            migrationBuilder.DropColumn(
                name: "authorization_version",
                table: "servers");

            migrationBuilder.DropColumn(
                name: "color",
                table: "server_roles");

            migrationBuilder.DropColumn(
                name: "created_by_user_id",
                table: "server_roles");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "server_roles");

            migrationBuilder.DropColumn(
                name: "mentionable",
                table: "server_roles");

            migrationBuilder.DropColumn(
                name: "version",
                table: "server_roles");

            migrationBuilder.DropColumn(
                name: "display_color_mode",
                table: "server_members");

            migrationBuilder.DropColumn(
                name: "display_color_role_id",
                table: "server_members");

            migrationBuilder.DropColumn(
                name: "roles_version",
                table: "server_members");
        }
    }
}
