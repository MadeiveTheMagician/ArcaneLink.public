using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class UserFriendConfiguration : IEntityTypeConfiguration<UserFriend>
    {
        public void Configure(EntityTypeBuilder<UserFriend> entity)
        {
            entity.ToTable("user_friends");

            entity.HasKey(x => new { x.UserId, x.FriendUserId });

            entity.Property(x => x.UserId)
                .HasColumnName("user_id")
                .IsRequired();

            entity.Property(x => x.FriendUserId)
                .HasColumnName("friend_user_id")
                .IsRequired();

            entity.Property(x => x.CreatedByRequestId)
                .HasColumnName("created_by_request_id")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasIndex(x => new { x.UserId, x.CreatedAt })
                .HasDatabaseName("IX_UserFriends_User_Time");

            entity.HasIndex(x => new { x.FriendUserId, x.UserId })
                .HasDatabaseName("IX_UserFriends_Friend_User");

            entity.HasIndex(x => x.CreatedByRequestId)
                .HasDatabaseName("IX_UserFriends_Request");

            entity.HasOne(x => x.User)
                .WithMany(x => x.Friends)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.FriendUser)
                .WithMany(x => x.FriendOfUsers)
                .HasForeignKey(x => x.FriendUserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.CreatedByRequest)
                .WithMany()
                .HasForeignKey(x => x.CreatedByRequestId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
