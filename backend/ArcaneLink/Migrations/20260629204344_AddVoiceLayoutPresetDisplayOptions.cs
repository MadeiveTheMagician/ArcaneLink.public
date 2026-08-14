using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddVoiceLayoutPresetDisplayOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "hide_service_info",
                table: "user_voice_layout_presets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "border_radius",
                table: "user_voice_layout_preset_slots",
                type: "double precision",
                nullable: false,
                defaultValue: 8.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "hide_service_info",
                table: "user_voice_layout_presets");

            migrationBuilder.DropColumn(
                name: "border_radius",
                table: "user_voice_layout_preset_slots");
        }
    }
}
