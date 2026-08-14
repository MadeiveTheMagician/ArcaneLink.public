using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations
{
    public class SpaceMessageConfiguration : IEntityTypeConfiguration<SpaceMessage>
    {
        public void Configure(EntityTypeBuilder<SpaceMessage> entity)
        {
            entity.ToTable("space_messages");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.SpaceId).HasColumnName("space_id").IsRequired();
            entity.Property(x => x.SenderUserId).HasColumnName("sender_user_id").IsRequired();
            entity.Property(x => x.MessageTypeId).HasColumnName("message_type_id").IsRequired();
            entity.Property(x => x.Body).HasColumnName("body");
            entity.Property(x => x.Payload).HasColumnName("payload").HasColumnType("jsonb");
            entity.Property(x => x.ReplyToMessageId).HasColumnName("reply_to_message_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
            entity.Property(x => x.EditedAt).HasColumnName("edited_at");
            entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
            entity.Property(x => x.DeletedByUserId).HasColumnName("deleted_by_user_id");

            entity.HasIndex(x => new { x.SpaceId, x.CreatedAt })
                .HasDatabaseName("IX_SpaceMessages_Space_Time");
            entity.HasIndex(x => new { x.SpaceId, x.CreatedAt, x.Id })
                .HasFilter("\"deleted_at\" IS NULL")
                .HasDatabaseName("IX_SpaceMessages_Unread");
            entity.HasIndex(x => new { x.SenderUserId, x.CreatedAt })
                .HasDatabaseName("IX_SpaceMessages_Sender_Time");
            entity.HasIndex(x => x.ReplyToMessageId)
                .HasDatabaseName("IX_SpaceMessages_ReplyTo");
            entity.HasIndex(x => new { x.DeletedAt, x.DeletedByUserId })
                .HasFilter("\"deleted_at\" IS NOT NULL")
                .HasDatabaseName("IX_SpaceMessages_PrivateTrashExpiry");
            entity.HasIndex(x => new
                {
                    x.SpaceId,
                    x.DeletedByUserId,
                    x.DeletedAt,
                    x.Id
                })
                .HasFilter("\"deleted_at\" IS NOT NULL")
                .HasDatabaseName("IX_SpaceMessages_PrivateTrashPage");

            entity.HasOne(x => x.Space)
                .WithMany()
                .HasForeignKey(x => x.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.SenderUser)
                .WithMany()
                .HasForeignKey(x => x.SenderUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.MessageType)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.MessageTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ReplyToMessage)
                .WithMany(x => x.Replies)
                .HasForeignKey(x => x.ReplyToMessageId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<ArcaneLink.DataBase.Models.UsersModels.User>()
                .WithMany()
                .HasForeignKey(x => x.DeletedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
