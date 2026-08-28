using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProfileSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_profile_settings",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    interface_scale = table.Column<double>(type: "double precision", nullable: false, defaultValue: 1.0),
                    font_scale = table.Column<double>(type: "double precision", nullable: false, defaultValue: 1.0),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_profile_settings", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_user_profile_settings_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                INSERT INTO user_profile_settings (user_id, interface_scale, font_scale, updated_at)
                SELECT id, 1.0, 1.0, NOW()
                FROM users
                WHERE deleted_at IS NULL
                ON CONFLICT (user_id) DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_profile_settings");
        }
    }
}
