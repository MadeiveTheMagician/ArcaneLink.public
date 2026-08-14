using ArcaneLink.DataBase.Models.NotificationsModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.NotificationsConfigurations
{
    public class UserNotificationConfiguration : IEntityTypeConfiguration<UserNotification>
    {
        public void Configure(EntityTypeBuilder<UserNotification> entity)
        {
            entity.ToTable("user_notifications");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
            entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(32).IsRequired();
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(160).IsRequired();
            entity.Property(x => x.Body).HasColumnName("body").HasMaxLength(500).IsRequired();
            entity.Property(x => x.Detail).HasColumnName("detail").HasMaxLength(2000);
            entity.Property(x => x.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(x => x.ServerId).HasColumnName("server_id");
            entity.Property(x => x.SpaceId).HasColumnName("space_id");
            entity.Property(x => x.MessageId).HasColumnName("message_id");
            entity.Property(x => x.InviteId).HasColumnName("invite_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            entity.Property(x => x.ReadAt).HasColumnName("read_at");

            entity.HasIndex(x => new { x.UserId, x.CreatedAt })
                .HasDatabaseName("IX_UserNotifications_User_Time");
            entity.HasIndex(x => new { x.UserId, x.ReadAt })
                .HasDatabaseName("IX_UserNotifications_User_Read");
            entity.HasIndex(x => new { x.UserId, x.MessageId })
                .IsUnique()
                .HasFilter("\"message_id\" IS NOT NULL")
                .HasDatabaseName("IX_UserNotifications_User_Message");
            entity.HasIndex(x => new { x.UserId, x.InviteId })
                .IsUnique()
                .HasFilter("\"invite_id\" IS NOT NULL")
                .HasDatabaseName("IX_UserNotifications_User_Invite");

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ActorUser)
                .WithMany()
                .HasForeignKey(x => x.ActorUserId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Server)
                .WithMany()
                .HasForeignKey(x => x.ServerId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Space)
                .WithMany()
                .HasForeignKey(x => x.SpaceId)
                .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(x => x.Message)
                .WithMany()
                .HasForeignKey(x => x.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Invite)
                .WithMany()
                .HasForeignKey(x => x.InviteId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
