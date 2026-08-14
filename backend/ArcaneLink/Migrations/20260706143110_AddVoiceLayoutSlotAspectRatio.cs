using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddVoiceLayoutSlotAspectRatio : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "aspect_ratio",
                table: "user_voice_layout_preset_slots",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "16:9");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "aspect_ratio",
                table: "user_voice_layout_preset_slots");
        }
    }
}
