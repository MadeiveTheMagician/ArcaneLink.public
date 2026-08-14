using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class UserVoiceLayoutPresetSlotConfiguration : IEntityTypeConfiguration<UserVoiceLayoutPresetSlot>
    {
        public void Configure(EntityTypeBuilder<UserVoiceLayoutPresetSlot> entity)
        {
            entity.ToTable("user_voice_layout_preset_slots");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id).HasColumnName("id").IsRequired();
            entity.Property(x => x.PresetId).HasColumnName("preset_id").IsRequired();
            entity.Property(x => x.SlotIndex).HasColumnName("slot_index").IsRequired();
            entity.Property(x => x.X).HasColumnName("x").IsRequired();
            entity.Property(x => x.Y).HasColumnName("y").IsRequired();
            entity.Property(x => x.Width).HasColumnName("width").IsRequired();
            entity.Property(x => x.Height).HasColumnName("height").IsRequired();
            entity.Property(x => x.BorderRadius)
                .HasColumnName("border_radius")
                .HasDefaultValue(8.0)
                .IsRequired();
            entity.Property(x => x.ZIndex).HasColumnName("z_index").IsRequired();
            entity.Property(x => x.Mode)
                .HasColumnName("mode")
                .HasMaxLength(16)
                .IsRequired();
            entity.Property(x => x.PreserveAspectRatio)
                .HasColumnName("preserve_aspect_ratio")
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(x => x.AspectRatio)
                .HasColumnName("aspect_ratio")
                .HasMaxLength(16)
                .HasDefaultValue("16:9")
                .IsRequired();

            entity.HasIndex(x => new { x.PresetId, x.SlotIndex })
                .IsUnique()
                .HasDatabaseName("UX_UserVoiceLayoutPresetSlots_Preset_SlotIndex");

            entity.HasOne(x => x.Preset)
                .WithMany(x => x.Slots)
                .HasForeignKey(x => x.PresetId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
