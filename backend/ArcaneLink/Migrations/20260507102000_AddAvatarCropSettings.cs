using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddAvatarCropSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "avatar_crop_offset_x",
                table: "user_profiles",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "avatar_crop_offset_y",
                table: "user_profiles",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "avatar_crop_zoom",
                table: "user_profiles",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "avatar_crop_offset_x",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "avatar_crop_offset_y",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "avatar_crop_zoom",
                table: "user_profiles");
        }
    }
}
