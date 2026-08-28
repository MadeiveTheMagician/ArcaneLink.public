using ArcaneLink.DataBase.Models.AssetsModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.AssetsConfigurations;

// EF-конфигурация таблицы assets.
//
// Держит database mapping отдельно от POCO-модели.
public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> entity)
    {
        entity.ToTable("assets");

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(x => x.OwnerUserId)
            .HasColumnName("owner_user_id");

        entity.Property(x => x.AssetTypeId)
            .HasColumnName("asset_type_id")
            .IsRequired();

        entity.Property(x => x.StorageKey)
            .HasColumnName("storage_key")
            .HasMaxLength(512)
            .IsRequired();

        entity.Property(x => x.OriginalFileName)
            .HasColumnName("original_file_name")
            .HasMaxLength(255);

        entity.Property(x => x.MimeType)
            .HasColumnName("mime_type")
            .HasMaxLength(100)
            .IsRequired();

        entity.Property(x => x.SizeBytes)
            .HasColumnName("size_bytes")
            .IsRequired();

        entity.Property(x => x.Sha256)
            .HasColumnName("sha256")
            .HasMaxLength(64)
            .IsFixedLength()
            .IsRequired();

        entity.Property(x => x.Width)
            .HasColumnName("width");

        entity.Property(x => x.Height)
            .HasColumnName("height");

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.Property(x => x.DeletedAt)
            .HasColumnName("deleted_at");

        entity.Property(x => x.PhysicalDeletedAt)
            .HasColumnName("physical_deleted_at");

        entity.HasIndex(x => new { x.OwnerUserId, x.CreatedAt })
            .HasDatabaseName("IX_Assets_Owner_Time");

        entity.HasIndex(x => new { x.AssetTypeId, x.CreatedAt })
            .HasDatabaseName("IX_Assets_Type_Time");

        entity.HasIndex(x => x.Sha256)
            .HasDatabaseName("IX_Assets_Sha256");

        entity.HasIndex(x => new { x.DeletedAt, x.PhysicalDeletedAt })
            .HasDatabaseName("IX_Assets_Deleted_PhysicalDeleted");

        // При удалении пользователя не удаляем файл автоматически.
        // Владелец сбрасывается, а cleanup/retention решается отдельным процессом.
        entity.HasOne(x => x.OwnerUser)
            .WithMany(x => x.Assets)
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Тип ассета — справочник, его нельзя удалить, пока есть связанные assets.
        entity.HasOne(x => x.AssetType)
            .WithMany(x => x.Assets)
            .HasForeignKey(x => x.AssetTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
