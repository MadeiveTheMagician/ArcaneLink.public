using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class UserDirectMessageBlockConfiguration
        : IEntityTypeConfiguration<UserDirectMessageBlock>
    {
        public void Configure(EntityTypeBuilder<UserDirectMessageBlock> entity)
        {
            entity.ToTable(
                "user_direct_message_blocks",
                table => table.HasCheckConstraint(
                    "CK_UserDirectMessageBlocks_DifferentUsers",
                    "\"user_id\" <> \"blocked_user_id\""));

            entity.HasKey(x => new { x.UserId, x.BlockedUserId });

            entity.Property(x => x.UserId)
                .HasColumnName("user_id")
                .ValueGeneratedNever();
            entity.Property(x => x.BlockedUserId)
                .HasColumnName("blocked_user_id")
                .ValueGeneratedNever();
            entity.Property(x => x.Comment)
                .HasColumnName("comment")
                .HasMaxLength(128);
            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasIndex(x => new { x.BlockedUserId, x.UserId })
                .HasDatabaseName("IX_UserDirectMessageBlocks_Blocked_User");

            entity.HasOne(x => x.User)
                .WithMany(x => x.DirectMessageBlocks)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.BlockedUser)
                .WithMany(x => x.DirectMessageBlockedBy)
                .HasForeignKey(x => x.BlockedUserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
