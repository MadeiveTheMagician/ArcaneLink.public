using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations;

public class SpaceMessageAssetConfiguration : IEntityTypeConfiguration<SpaceMessageAsset>
{
    public void Configure(EntityTypeBuilder<SpaceMessageAsset> entity)
    {
        entity.ToTable("space_message_assets");

        entity.HasKey(x => new { x.MessageId, x.AssetId });

        entity.Property(x => x.MessageId).HasColumnName("message_id").IsRequired();
        entity.Property(x => x.AssetId).HasColumnName("asset_id").IsRequired();
        entity.Property(x => x.DisplayOrder)
            .HasColumnName("display_order")
            .IsRequired();
        entity.Property(x => x.DisplayName)
            .HasColumnName("display_name")
            .HasMaxLength(255);
        entity.Property(x => x.IsSpoiler)
            .HasColumnName("is_spoiler")
            .HasDefaultValue(false)
            .IsRequired();

        entity.HasIndex(x => new { x.MessageId, x.AssetId })
            .IsUnique()
            .HasDatabaseName("UX_SpaceMessageAssets_Message_Asset");
        entity.HasIndex(x => new { x.AssetId, x.MessageId })
            .HasDatabaseName("IX_SpaceMessageAssets_Asset_Message");
        entity.HasIndex(x => new { x.MessageId, x.DisplayOrder })
            .HasDatabaseName("IX_SpaceMessageAssets_Message_Order");

        entity.HasOne(x => x.Message)
            .WithMany(x => x.Assets)
            .HasForeignKey(x => x.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.Asset)
            .WithMany()
            .HasForeignKey(x => x.AssetId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
