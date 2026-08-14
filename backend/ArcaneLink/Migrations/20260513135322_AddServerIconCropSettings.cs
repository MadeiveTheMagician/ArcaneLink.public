using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddServerIconCropSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "icon_crop_offset_x",
                table: "servers",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "icon_crop_offset_y",
                table: "servers",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "icon_crop_zoom",
                table: "servers",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "icon_crop_offset_x",
                table: "servers");

            migrationBuilder.DropColumn(
                name: "icon_crop_offset_y",
                table: "servers");

            migrationBuilder.DropColumn(
                name: "icon_crop_zoom",
                table: "servers");
        }
    }
}
