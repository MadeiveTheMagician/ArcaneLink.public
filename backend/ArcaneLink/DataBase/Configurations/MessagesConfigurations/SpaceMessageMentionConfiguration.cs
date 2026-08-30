using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations;

public class SpaceMessageMentionConfiguration : IEntityTypeConfiguration<SpaceMessageMention>
{
    public void Configure(EntityTypeBuilder<SpaceMessageMention> entity)
    {
        entity.ToTable("space_message_mentions", table =>
        {
            table.HasCheckConstraint(
                "CK_SpaceMessageMentions_Kind_Target",
                "(\"kind\" = 'user' AND \"target_user_id\" IS NOT NULL AND \"target_role_id\" IS NULL) OR " +
                "(\"kind\" = 'role' AND \"target_user_id\" IS NULL AND \"target_role_id\" IS NOT NULL) OR " +
                "(\"kind\" = 'everyone' AND \"target_user_id\" IS NULL AND \"target_role_id\" IS NULL)");
            table.HasCheckConstraint(
                "CK_SpaceMessageMentions_Range",
                "\"start\" >= 0 AND \"length\" > 0");
        });

        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.MessageId).HasColumnName("message_id").IsRequired();
        entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(16).IsRequired();
        entity.Property(x => x.TargetUserId).HasColumnName("target_user_id");
        entity.Property(x => x.TargetRoleId).HasColumnName("target_role_id");
        entity.Property(x => x.DisplayText).HasColumnName("display_text").HasMaxLength(128).IsRequired();
        entity.Property(x => x.Start).HasColumnName("start").IsRequired();
        entity.Property(x => x.Length).HasColumnName("length").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();

        entity.HasIndex(x => new { x.MessageId, x.Start })
            .IsUnique()
            .HasDatabaseName("UX_SpaceMessageMentions_Message_Start");
        entity.HasIndex(x => x.TargetUserId)
            .HasDatabaseName("IX_SpaceMessageMentions_TargetUser");
        entity.HasIndex(x => x.TargetRoleId)
            .HasDatabaseName("IX_SpaceMessageMentions_TargetRole");

        entity.HasOne(x => x.Message)
            .WithMany(x => x.Mentions)
            .HasForeignKey(x => x.MessageId)
            .OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.TargetUser)
            .WithMany()
            .HasForeignKey(x => x.TargetUserId)
            .OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.TargetRole)
            .WithMany()
            .HasForeignKey(x => x.TargetRoleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
