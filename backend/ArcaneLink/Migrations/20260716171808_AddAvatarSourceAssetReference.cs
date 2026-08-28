using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcaneLink.Migrations
{
    /// <inheritdoc />
    public partial class AddAvatarSourceAssetReference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "avatar_source_asset_id",
                table: "user_profiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE user_profiles AS profile
                SET avatar_source_asset_id = (
                    SELECT candidate.id
                    FROM assets AS candidate
                    INNER JOIN assets AS current_avatar
                        ON current_avatar.id = profile.avatar_asset_id
                    WHERE candidate.owner_user_id = profile.user_id
                      AND candidate.asset_type_id = '11000000-0000-0000-0000-000000000000'
                      AND candidate.deleted_at IS NULL
                      AND candidate.created_at <= current_avatar.created_at
                    ORDER BY candidate.created_at DESC
                    LIMIT 1
                )
                WHERE profile.avatar_asset_id IS NOT NULL
                  AND profile.avatar_source_asset_id IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_user_profiles_avatar_source_asset_id",
                table: "user_profiles",
                column: "avatar_source_asset_id");

            migrationBuilder.AddForeignKey(
                name: "FK_user_profiles_assets_avatar_source_asset_id",
                table: "user_profiles",
                column: "avatar_source_asset_id",
                principalTable: "assets",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_profiles_assets_avatar_source_asset_id",
                table: "user_profiles");

            migrationBuilder.DropIndex(
                name: "IX_user_profiles_avatar_source_asset_id",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "avatar_source_asset_id",
                table: "user_profiles");
        }
    }
}
