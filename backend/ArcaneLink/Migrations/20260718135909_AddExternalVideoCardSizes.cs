using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalVideoCardSizes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "horizontal_video_card_size",
                table: "user_profile_settings",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "vertical_video_card_size",
                table: "user_profile_settings",
                type: "integer",
                nullable: false,
                defaultValue: 3);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "horizontal_video_card_size",
                table: "user_profile_settings");

            migrationBuilder.DropColumn(
                name: "vertical_video_card_size",
                table: "user_profile_settings");
        }
    }
}
