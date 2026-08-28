using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ServersConfigurations;

public sealed class ServerMemberProfileConfiguration :
    IEntityTypeConfiguration<ServerMemberProfile>
{
    public void Configure(EntityTypeBuilder<ServerMemberProfile> entity)
    {
        entity.ToTable("server_member_profiles");

        entity.HasKey(x => x.ServerMemberId);

        entity.Property(x => x.ServerMemberId)
            .HasColumnName("server_member_id")
            .ValueGeneratedNever();
        entity.Property(x => x.DisplayName)
            .HasColumnName("display_name")
            .HasMaxLength(128);
        entity.Property(x => x.DisplayNameNorm)
            .HasColumnName("display_name_norm")
            .HasMaxLength(128);
        entity.Property(x => x.AvatarAssetId)
            .HasColumnName("avatar_asset_id");
        entity.Property(x => x.AvatarSourceAssetId)
            .HasColumnName("avatar_source_asset_id");
        entity.Property(x => x.AvatarCropOffsetX)
            .HasColumnName("avatar_crop_offset_x")
            .HasDefaultValue(0d);
        entity.Property(x => x.AvatarCropOffsetY)
            .HasColumnName("avatar_crop_offset_y")
            .HasDefaultValue(0d);
        entity.Property(x => x.AvatarCropZoom)
            .HasColumnName("avatar_crop_zoom")
            .HasDefaultValue(1d);
        entity.Property(x => x.BannerAssetId)
            .HasColumnName("banner_asset_id");
        entity.Property(x => x.About)
            .HasColumnName("about")
            .HasMaxLength(512);
        entity.Property(x => x.StatusText)
            .HasColumnName("status_text")
            .HasMaxLength(128);
        entity.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        entity.HasIndex(x => x.DisplayNameNorm)
            .HasDatabaseName("IX_ServerMemberProfiles_DisplayNameNorm");

        entity.HasOne(x => x.ServerMember)
            .WithOne(x => x.ServerProfile)
            .HasForeignKey<ServerMemberProfile>(x => x.ServerMemberId)
            .OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.AvatarAsset)
            .WithMany()
            .HasForeignKey(x => x.AvatarAssetId)
            .OnDelete(DeleteBehavior.SetNull);
        entity.HasOne(x => x.AvatarSourceAsset)
            .WithMany()
            .HasForeignKey(x => x.AvatarSourceAssetId)
            .OnDelete(DeleteBehavior.SetNull);
        entity.HasOne(x => x.BannerAsset)
            .WithMany()
            .HasForeignKey(x => x.BannerAssetId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
