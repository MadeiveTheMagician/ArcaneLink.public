using ArcaneLink.DataBase.Models.SpacesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.SpacesConfigurations;

public class PrivateSpaceFolderConfiguration : IEntityTypeConfiguration<PrivateSpaceFolder>
{
    public void Configure(EntityTypeBuilder<PrivateSpaceFolder> entity)
    {
        entity.ToTable("private_space_folders");
        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(48).IsRequired();
        entity.Property(x => x.Icon).HasColumnName("icon").HasMaxLength(16).IsRequired();
        entity.Property(x => x.Color).HasColumnName("color").HasMaxLength(9);
        entity.Property(x => x.Position).HasColumnName("position").IsRequired();
        entity.Property(x => x.IsOrderLocked)
            .HasColumnName("is_order_locked")
            .HasDefaultValue(false)
            .IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();

        entity.HasIndex(x => new { x.UserId, x.Position })
            .HasDatabaseName("IX_PrivateSpaceFolders_User_Position");

        entity.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PrivateSpaceFolderItemConfiguration : IEntityTypeConfiguration<PrivateSpaceFolderItem>
{
    public void Configure(EntityTypeBuilder<PrivateSpaceFolderItem> entity)
    {
        entity.ToTable("private_space_folder_items");
        entity.HasKey(x => new { x.FolderId, x.SpaceId });

        entity.Property(x => x.FolderId).HasColumnName("folder_id");
        entity.Property(x => x.SpaceId).HasColumnName("space_id");
        entity.Property(x => x.Position).HasColumnName("position").IsRequired();
        entity.Property(x => x.ActivityAt)
            .HasColumnName("activity_at")
            .IsRequired();
        entity.Property(x => x.PinnedAt).HasColumnName("pinned_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();

        entity.HasIndex(x => new { x.FolderId, x.Position })
            .HasDatabaseName("IX_PrivateSpaceFolderItems_Folder_Position");

        entity.HasIndex(x => new { x.FolderId, x.PinnedAt })
            .HasDatabaseName("IX_PrivateSpaceFolderItems_Folder_PinnedAt");

        entity.HasIndex(x => new
        {
            x.FolderId,
            x.PinnedAt,
            x.ActivityAt,
            x.Position
        })
            .HasDatabaseName(
                "IX_PrivateSpaceFolderItems_Folder_Activity");

        entity.HasOne(x => x.Folder)
            .WithMany(x => x.Items)
            .HasForeignKey(x => x.FolderId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.PrivateSpace)
            .WithMany()
            .HasForeignKey(x => x.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
