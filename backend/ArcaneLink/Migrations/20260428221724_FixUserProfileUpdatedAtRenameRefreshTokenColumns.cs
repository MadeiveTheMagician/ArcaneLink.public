using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class FixUserProfileUpdatedAtRenameRefreshTokenColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_refresh_tokens_user_refresh_tokens_ReplacedByTokenId",
                table: "user_refresh_tokens");

            migrationBuilder.DropForeignKey(
                name: "FK_user_refresh_tokens_users_UserId",
                table: "user_refresh_tokens");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "user_refresh_tokens",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "user_refresh_tokens",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "UserAgent",
                table: "user_refresh_tokens",
                newName: "user_agent");

            migrationBuilder.RenameColumn(
                name: "TokenHash",
                table: "user_refresh_tokens",
                newName: "token_hash");

            migrationBuilder.RenameColumn(
                name: "RevokedByIp",
                table: "user_refresh_tokens",
                newName: "revoked_by_ip");

            migrationBuilder.RenameColumn(
                name: "RevokedAt",
                table: "user_refresh_tokens",
                newName: "revoked_at");

            migrationBuilder.RenameColumn(
                name: "ReplacedByTokenId",
                table: "user_refresh_tokens",
                newName: "replaced_by_token_id");

            migrationBuilder.RenameColumn(
                name: "ExpiresAt",
                table: "user_refresh_tokens",
                newName: "expires_at");

            migrationBuilder.RenameColumn(
                name: "CreatedByIp",
                table: "user_refresh_tokens",
                newName: "created_by_ip");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "user_refresh_tokens",
                newName: "created_at");

            migrationBuilder.AddForeignKey(
                name: "FK_user_refresh_tokens_user_refresh_tokens_replaced_by_token_id",
                table: "user_refresh_tokens",
                column: "replaced_by_token_id",
                principalTable: "user_refresh_tokens",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_user_refresh_tokens_users_user_id",
                table: "user_refresh_tokens",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_refresh_tokens_user_refresh_tokens_replaced_by_token_id",
                table: "user_refresh_tokens");

            migrationBuilder.DropForeignKey(
                name: "FK_user_refresh_tokens_users_user_id",
                table: "user_refresh_tokens");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "user_refresh_tokens",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "user_refresh_tokens",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "user_agent",
                table: "user_refresh_tokens",
                newName: "UserAgent");

            migrationBuilder.RenameColumn(
                name: "token_hash",
                table: "user_refresh_tokens",
                newName: "TokenHash");

            migrationBuilder.RenameColumn(
                name: "revoked_by_ip",
                table: "user_refresh_tokens",
                newName: "RevokedByIp");

            migrationBuilder.RenameColumn(
                name: "revoked_at",
                table: "user_refresh_tokens",
                newName: "RevokedAt");

            migrationBuilder.RenameColumn(
                name: "replaced_by_token_id",
                table: "user_refresh_tokens",
                newName: "ReplacedByTokenId");

            migrationBuilder.RenameColumn(
                name: "expires_at",
                table: "user_refresh_tokens",
                newName: "ExpiresAt");

            migrationBuilder.RenameColumn(
                name: "created_by_ip",
                table: "user_refresh_tokens",
                newName: "CreatedByIp");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "user_refresh_tokens",
                newName: "CreatedAt");

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
    }
}
