using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.AssetsModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.AssetsConfigurations;

// EF-конфигурация справочника asset_types.
public class AssetTypeConfiguration : IEntityTypeConfiguration<AssetType>
{
    public void Configure(EntityTypeBuilder<AssetType> entity)
    {
        entity.ToTable("asset_types");

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(x => x.Code)
            .HasColumnName("code")
            .HasMaxLength(32)
            .IsRequired();

        entity.Property(x => x.Title)
            .HasColumnName("title")
            .HasMaxLength(64)
            .IsRequired();

        entity.Property(x => x.IsUserUpload)
            .HasColumnName("is_user_upload")
            .IsRequired();

        entity.HasIndex(x => x.Code)
            .IsUnique()
            .HasDatabaseName("UX_AssetTypes_Code");

        // Seed data держит базовые типы ассетов доступными сразу после миграции.
        entity.HasData(
            new AssetType
            {
                Id = AssetTypeIds.Avatar,
                Code = "avatar",
                Title = "Avatar",
                IsUserUpload = true
            },
            new AssetType
            {
                Id = AssetTypeIds.Banner,
                Code = "banner",
                Title = "Banner",
                IsUserUpload = true
            },
            new AssetType
            {
                Id = AssetTypeIds.MessageAttachment,
                Code = "message_attachment",
                Title = "Message attachment",
                IsUserUpload = true
            },
            new AssetType
            {
                Id = AssetTypeIds.ServerIcon,
                Code = "server_icon",
                Title = "Server icon",
                IsUserUpload = true
            },
            new AssetType
            {
                Id = AssetTypeIds.GameAvatar,
                Code = "game_avatar",
                Title = "Game avatar",
                IsUserUpload = true
            },
            new AssetType
            {
                Id = AssetTypeIds.ProfileBackground,
                Code = "profile_background",
                Title = "Profile background",
                IsUserUpload = true
            },
            new AssetType
            {
                Id = AssetTypeIds.CurrentAvatar,
                Code = "avatar_current",
                Title = "Current optimized avatar",
                IsUserUpload = false
            },
            new AssetType
            {
                Id = AssetTypeIds.Other,
                Code = "other",
                Title = "Other",
                IsUserUpload = true
            });
    }
}
