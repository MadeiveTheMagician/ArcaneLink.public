using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ServersConfigurations
{
    public class ServerConfiguration : IEntityTypeConfiguration<Server>
    {
        public void Configure(EntityTypeBuilder<Server> entity)
        {
            entity.ToTable(
                "servers",
                table => table.HasCheckConstraint(
                    "CK_Servers_AccessMode",
                    "\"access_mode\" IN ('public', 'restricted', 'private')"));

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(x => x.CreatedByUserId)
                .HasColumnName("created_by_user_id")
                .IsRequired();

            entity.Property(x => x.OwnerUserId)
                .HasColumnName("owner_user_id")
                .IsRequired();

            entity.Property(x => x.Slug)
                .HasColumnName("slug")
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.Title)
                .HasColumnName("title")
                .HasMaxLength(128)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasColumnName("description")
                .HasMaxLength(512);

            entity.Property(x => x.IconAssetId)
                .HasColumnName("icon_asset_id");

            entity.Property(x => x.IconCropOffsetX)
                .HasColumnName("icon_crop_offset_x")
                .HasDefaultValue(0.0)
                .IsRequired();

            entity.Property(x => x.IconCropOffsetY)
                .HasColumnName("icon_crop_offset_y")
                .HasDefaultValue(0.0)
                .IsRequired();

            entity.Property(x => x.IconCropZoom)
                .HasColumnName("icon_crop_zoom")
                .HasDefaultValue(1.0)
                .IsRequired();

            entity.Property(x => x.DefaultTextSpaceId)
                .HasColumnName("default_text_space_id");

            entity.Property(x => x.AccessMode)
                .HasColumnName("access_mode")
                .HasMaxLength(16)
                .HasDefaultValue("private")
                .IsRequired();

            entity.Property(x => x.IsSystem)
                .HasColumnName("is_system")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(x => x.SpaceAclRevision)
                .HasColumnName("space_acl_revision")
                .HasDefaultValueSql("gen_random_uuid()")
                .IsRequired();

            entity.Property(x => x.AuthorizationVersion)
                .HasColumnName("authorization_version")
                .HasDefaultValueSql("gen_random_uuid()")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.Property(x => x.DeletedAt)
                .HasColumnName("deleted_at");

            entity.HasIndex(x => x.Slug)
                .IsUnique()
                .HasDatabaseName("UX_Servers_Slug");

            entity.HasIndex(x => new { x.OwnerUserId, x.CreatedAt })
                .HasDatabaseName("IX_Servers_Owner_Time");

            entity.HasIndex(x => new { x.CreatedByUserId, x.CreatedAt })
                .HasDatabaseName("IX_Servers_Creator_Time");

            entity.HasIndex(x => new { x.AccessMode, x.UpdatedAt })
                .HasDatabaseName("IX_Servers_AccessMode_Time");

            entity.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.OwnerUser)
                .WithMany()
                .HasForeignKey(x => x.OwnerUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.IconAsset)
                .WithMany()
                .HasForeignKey(x => x.IconAssetId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.DefaultTextSpace)
                .WithMany()
                .HasForeignKey(x => x.DefaultTextSpaceId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
