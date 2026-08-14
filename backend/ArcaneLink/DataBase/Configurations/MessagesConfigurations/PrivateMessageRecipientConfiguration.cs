using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations
{
    public sealed class PrivateMessageRecipientConfiguration
        : IEntityTypeConfiguration<PrivateMessageRecipient>
    {
        public void Configure(
            EntityTypeBuilder<PrivateMessageRecipient> entity)
        {
            entity.ToTable("private_message_recipients");

            entity.HasKey(recipient => new
            {
                recipient.MessageId,
                recipient.UserId
            });

            entity.Property(recipient => recipient.MessageId)
                .HasColumnName("message_id")
                .IsRequired();
            entity.Property(recipient => recipient.UserId)
                .HasColumnName("user_id")
                .IsRequired();

            entity.HasIndex(recipient => new
                {
                    recipient.UserId,
                    recipient.MessageId
                })
                .HasDatabaseName(
                    "IX_PrivateMessageRecipients_User_Message");

            entity.HasOne(recipient => recipient.Message)
                .WithMany(message => message.Recipients)
                .HasForeignKey(recipient => recipient.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(recipient => recipient.User)
                .WithMany()
                .HasForeignKey(recipient => recipient.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
