using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations;

public class SpaceMessageReactionConfiguration : IEntityTypeConfiguration<SpaceMessageReaction>
{
    public void Configure(EntityTypeBuilder<SpaceMessageReaction> entity)
    {
        entity.ToTable("space_message_reactions");

        entity.HasKey(x => new { x.MessageId, x.UserId, x.EmojiCode });

        entity.Property(x => x.MessageId).HasColumnName("message_id").IsRequired();
        entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.EmojiCode).HasColumnName("emoji_code").HasMaxLength(64).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();

        entity.HasIndex(x => new { x.MessageId, x.UserId, x.EmojiCode })
            .IsUnique()
            .HasDatabaseName("UX_SpaceMessageReactions_Message_User_Emoji");
        entity.HasIndex(x => new { x.MessageId, x.EmojiCode, x.CreatedAt })
            .HasDatabaseName("IX_SpaceMessageReactions_Message_Emoji_Time");
        entity.HasIndex(x => new { x.UserId, x.CreatedAt })
            .HasDatabaseName("IX_SpaceMessageReactions_User_Time");

        entity.HasOne(x => x.Message)
            .WithMany(x => x.Reactions)
            .HasForeignKey(x => x.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
