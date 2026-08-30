using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileTagsAndDiscovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "profile_tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: false),
                    title = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_profile_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_profile_tags",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_profile_tags", x => new { x.user_id, x.tag_id });
                    table.ForeignKey(
                        name: "FK_user_profile_tags_profile_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "profile_tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_profile_tags_user_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "user_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "profile_tags",
                columns: new[] { "id", "code", "display_order", "title" },
                values: new object[,]
                {
                    { new Guid("27000000-0000-0000-0000-000000000001"), "gaming", 10, "Игры" },
                    { new Guid("27000000-0000-0000-0000-000000000002"), "art", 20, "Арт" },
                    { new Guid("27000000-0000-0000-0000-000000000003"), "music", 30, "Музыка" },
                    { new Guid("27000000-0000-0000-0000-000000000004"), "anime", 40, "Аниме" },
                    { new Guid("27000000-0000-0000-0000-000000000005"), "technology", 50, "Технологии" },
                    { new Guid("27000000-0000-0000-0000-000000000006"), "programming", 60, "Программирование" },
                    { new Guid("27000000-0000-0000-0000-000000000007"), "roleplay", 70, "Ролевые" },
                    { new Guid("27000000-0000-0000-0000-000000000008"), "movies", 80, "Кино" },
                    { new Guid("27000000-0000-0000-0000-000000000009"), "chill", 90, "Спокойное общение" },
                    { new Guid("27000000-0000-0000-0000-000000000010"), "education", 100, "Обучение" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_profile_tags_code",
                table: "profile_tags",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_profile_tags_tag_id",
                table: "user_profile_tags",
                column: "tag_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_profile_tags");

            migrationBuilder.DropTable(
                name: "profile_tags");
        }
    }
}
