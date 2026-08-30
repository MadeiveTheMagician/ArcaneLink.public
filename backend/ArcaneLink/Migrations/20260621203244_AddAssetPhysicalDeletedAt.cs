using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetPhysicalDeletedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "physical_deleted_at",
                table: "assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Assets_Deleted_PhysicalDeleted",
                table: "assets",
                columns: new[] { "deleted_at", "physical_deleted_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Assets_Deleted_PhysicalDeleted",
                table: "assets");

            migrationBuilder.DropColumn(
                name: "physical_deleted_at",
                table: "assets");
        }
    }
}
