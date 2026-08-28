using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations;

public class UserVoiceLayoutPresetConfiguration : IEntityTypeConfiguration<UserVoiceLayoutPreset>
{
    public void Configure(EntityTypeBuilder<UserVoiceLayoutPreset> entity)
    {
        entity.ToTable("user_voice_layout_presets");

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id).HasColumnName("id").IsRequired();
        entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.Name)
            .HasColumnName("name")
            .HasMaxLength(96)
            .IsRequired();
        entity.Property(x => x.IsPinned)
            .HasColumnName("is_pinned")
            .HasDefaultValue(false)
            .IsRequired();
        entity.Property(x => x.ShowParticipantsWithoutVideo)
            .HasColumnName("show_participants_without_video")
            .HasDefaultValue(true)
            .IsRequired();
        entity.Property(x => x.HideServiceInfo)
            .HasColumnName("hide_service_info")
            .HasDefaultValue(false)
            .IsRequired();
        entity.Property(x => x.GridColumns)
            .HasColumnName("grid_columns")
            .IsRequired();
        entity.Property(x => x.GridRows)
            .HasColumnName("grid_rows")
            .IsRequired();
        entity.Property(x => x.CellSizePx)
            .HasColumnName("cell_size_px")
            .IsRequired();
        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();
        entity.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        entity.HasIndex(x => new { x.UserId, x.Name })
            .HasDatabaseName("IX_UserVoiceLayoutPresets_User_Name");

        entity.HasOne(x => x.User)
            .WithMany(x => x.VoiceLayoutPresets)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
