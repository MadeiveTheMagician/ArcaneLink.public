using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class RenameRefreshTokensTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserRefreshTokens_UserRefreshTokens_ReplacedByTokenId",
                table: "UserRefreshTokens");

            migrationBuilder.DropForeignKey(
                name: "FK_UserRefreshTokens_users_UserId",
                table: "UserRefreshTokens");

            migrationBuilder.DropPrimaryKey(
                name: "PK_UserRefreshTokens",
                table: "UserRefreshTokens");

            migrationBuilder.RenameTable(
                name: "UserRefreshTokens",
                newName: "user_refresh_tokens");

            migrationBuilder.AddPrimaryKey(
                name: "PK_user_refresh_tokens",
                table: "user_refresh_tokens",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_user_refresh_tokens_user_refresh_tokens_ReplacedByTokenId",
                table: "user_refresh_tokens",
                column: "ReplacedByTokenId",
                principalTable: "user_refresh_tokens",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_user_refresh_tokens_users_UserId",
                table: "user_refresh_tokens",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_refresh_tokens_user_refresh_tokens_ReplacedByTokenId",
                table: "user_refresh_tokens");

            migrationBuilder.DropForeignKey(
                name: "FK_user_refresh_tokens_users_UserId",
                table: "user_refresh_tokens");

            migrationBuilder.DropPrimaryKey(
                name: "PK_user_refresh_tokens",
                table: "user_refresh_tokens");

            migrationBuilder.RenameTable(
                name: "user_refresh_tokens",
                newName: "UserRefreshTokens");

            migrationBuilder.AddPrimaryKey(
                name: "PK_UserRefreshTokens",
                table: "UserRefreshTokens",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_UserRefreshTokens_UserRefreshTokens_ReplacedByTokenId",
                table: "UserRefreshTokens",
                column: "ReplacedByTokenId",
                principalTable: "UserRefreshTokens",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserRefreshTokens_users_UserId",
                table: "UserRefreshTokens",
                column: "UserId",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
