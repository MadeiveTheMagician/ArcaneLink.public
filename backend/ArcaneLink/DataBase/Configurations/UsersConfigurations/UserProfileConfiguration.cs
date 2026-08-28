using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
    {
        public void Configure(EntityTypeBuilder<UserProfile> entity)
        {
            entity.ToTable("user_profiles");

            // Primary Key + Foreign Key на users.id
            entity.HasKey(p => p.UserId);

            entity.Property(p => p.UserId)
                .HasColumnName("user_id");

            entity.Property(p => p.DisplayName)
                .HasColumnName("display_name")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(p => p.DisplayNameNorm)
                .HasColumnName("display_name_norm")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(p => p.AvatarAssetId)
                .HasColumnName("avatar_asset_id");

            entity.Property(p => p.AvatarSourceAssetId)
                .HasColumnName("avatar_source_asset_id");

            entity.Property(p => p.AvatarCropOffsetX)
                .HasColumnName("avatar_crop_offset_x")
                .HasDefaultValue(0)
                .IsRequired();

            entity.Property(p => p.AvatarCropOffsetY)
                .HasColumnName("avatar_crop_offset_y")
                .HasDefaultValue(0)
                .IsRequired();

            entity.Property(p => p.AvatarCropZoom)
                .HasColumnName("avatar_crop_zoom")
                .HasDefaultValue(1)
                .IsRequired();

            entity.Property(p => p.BannerAssetId)
                .HasColumnName("banner_asset_id");

            entity.Property(p => p.Bio)
                .HasColumnName("bio")
                .HasMaxLength(512);

            entity.Property(p => p.WebsiteUrl)
                .HasColumnName("website_url")
                .HasMaxLength(256);

            // UpdatedAt НЕ автообновляется PostgreSQL сам по себе.
            //
            // Поэтому не используем ValueGeneratedOnAddOrUpdate().
            // Значение выставляем руками в сервисах:
            // UpdatedAt = DateTime.UtcNow
            entity.Property(p => p.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            // Связь 1 к 1:
            // users.id <-> user_profiles.user_id
            entity.HasOne(p => p.User)
                .WithOne(u => u.Profile)
                .HasForeignKey<UserProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(p => p.AvatarAsset)
                .WithMany()
                .HasForeignKey(p => p.AvatarAssetId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(p => p.AvatarSourceAsset)
                .WithMany()
                .HasForeignKey(p => p.AvatarSourceAssetId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(p => p.BannerAsset)
                .WithMany()
                .HasForeignKey(p => p.BannerAssetId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
