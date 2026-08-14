using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUserVoiceLayoutPresets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_voice_layout_presets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
                    is_pinned = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    show_participants_without_video = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    grid_columns = table.Column<int>(type: "integer", nullable: false),
                    grid_rows = table.Column<int>(type: "integer", nullable: false),
                    cell_size_px = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_voice_layout_presets", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_voice_layout_presets_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_voice_layout_preset_slots",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    preset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slot_index = table.Column<int>(type: "integer", nullable: false),
                    x = table.Column<double>(type: "double precision", nullable: false),
                    y = table.Column<double>(type: "double precision", nullable: false),
                    width = table.Column<double>(type: "double precision", nullable: false),
                    height = table.Column<double>(type: "double precision", nullable: false),
                    z_index = table.Column<int>(type: "integer", nullable: false),
                    mode = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    preserve_aspect_ratio = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_voice_layout_preset_slots", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_voice_layout_preset_slots_user_voice_layout_presets_pr~",
                        column: x => x.preset_id,
                        principalTable: "user_voice_layout_presets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "UX_UserVoiceLayoutPresetSlots_Preset_SlotIndex",
                table: "user_voice_layout_preset_slots",
                columns: new[] { "preset_id", "slot_index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserVoiceLayoutPresets_User_Name",
                table: "user_voice_layout_presets",
                columns: new[] { "user_id", "name" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_voice_layout_preset_slots");

            migrationBuilder.DropTable(
                name: "user_voice_layout_presets");
        }
    }
}
