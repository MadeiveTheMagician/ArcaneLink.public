using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations;

public class SpacePinnedMessageConfiguration : IEntityTypeConfiguration<SpacePinnedMessage>
{
    public void Configure(EntityTypeBuilder<SpacePinnedMessage> entity)
    {
        entity.ToTable("space_pinned_messages");

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.SpaceId).HasColumnName("space_id").IsRequired();
        entity.Property(x => x.MessageId).HasColumnName("message_id").IsRequired();
        entity.Property(x => x.PinnedByUserId).HasColumnName("pinned_by_user_id").IsRequired();
        entity.Property(x => x.PinnedAt).HasColumnName("pinned_at").IsRequired();
        entity.Property(x => x.UnpinnedAt).HasColumnName("unpinned_at");
        entity.Property(x => x.UnpinnedByUserId).HasColumnName("unpinned_by_user_id");

        entity.HasIndex(x => new { x.SpaceId, x.MessageId })
            .IsUnique()
            .HasDatabaseName("UX_SpacePinnedMessages_Space_Message");
        entity.HasIndex(x => new { x.SpaceId, x.PinnedAt })
            .HasDatabaseName("IX_SpacePinnedMessages_Space_Time");

        entity.HasOne(x => x.Space)
            .WithMany()
            .HasForeignKey(x => x.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.Message)
            .WithMany()
            .HasForeignKey(x => x.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.PinnedByUser)
            .WithMany()
            .HasForeignKey(x => x.PinnedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.UnpinnedByUser)
            .WithMany()
            .HasForeignKey(x => x.UnpinnedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
