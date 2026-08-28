using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSubscriptionTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "subscription_type_id",
                table: "users",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("14000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "subscription_types",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    rank = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_subscription_types", x => x.id);
                });

            migrationBuilder.InsertData(
                table: "subscription_types",
                columns: new[] { "id", "code", "rank", "title" },
                values: new object[,]
                {
                    { new Guid("14000000-0000-0000-0000-000000000000"), "free", 0, "Free" },
                    { new Guid("14000000-0000-0000-0000-000000000001"), "plus", 10, "Plus" },
                    { new Guid("14000000-0000-0000-0000-000000000002"), "prime", 20, "Prime" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_SubscriptionTypeId",
                table: "users",
                column: "subscription_type_id");

            migrationBuilder.CreateIndex(
                name: "UX_SubscriptionTypes_Code",
                table: "subscription_types",
                column: "code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_users_subscription_types_subscription_type_id",
                table: "users",
                column: "subscription_type_id",
                principalTable: "subscription_types",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_users_subscription_types_subscription_type_id",
                table: "users");

            migrationBuilder.DropTable(
                name: "subscription_types");

            migrationBuilder.DropIndex(
                name: "IX_Users_SubscriptionTypeId",
                table: "users");

            migrationBuilder.DropColumn(
                name: "subscription_type_id",
                table: "users");
        }
    }
}
