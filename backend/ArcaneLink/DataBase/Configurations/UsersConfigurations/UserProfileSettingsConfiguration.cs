using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.DataBase.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class UserProfileSettingsConfiguration : IEntityTypeConfiguration<UserProfileSettings>
    {
        public void Configure(EntityTypeBuilder<UserProfileSettings> entity)
        {
            entity.ToTable(
                "user_profile_settings",
                table =>
                {
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_PresenceVisibility",
                        "presence_visibility IN ('everyone', 'friends', 'nobody') OR presence_visibility LIKE 'custom:%'");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_PresenceMode",
                        "presence_mode IN ('automatic', 'invisible')");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_DirectMessagePermission",
                        "direct_message_permission IN ('everyone', 'friends', 'shared_servers', 'nobody') OR direct_message_permission LIKE 'custom:%'");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_ServerMessageDisplayFormat",
                        "server_message_display_format IN ('wall-scroll', 'bubble')");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_PrivateMessageDisplayFormat",
                        "private_message_display_format IN ('wall-scroll', 'bubble')");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_ServerMessageBubbleAlignment",
                        "server_message_bubble_alignment IN ('one-side-left', 'one-side-right', 'own-left', 'own-right')");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_PrivateMessageBubbleAlignment",
                        "private_message_bubble_alignment IN ('one-side-left', 'one-side-right', 'own-left', 'own-right')");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_ServerMessageBubbleWidth",
                        "server_message_bubble_width IN ('standard', 'full-width')");
                    table.HasCheckConstraint(
                        "CK_UserProfileSettings_PrivateMessageBubbleWidth",
                        "private_message_bubble_width IN ('standard', 'full-width')");
                });

            entity.HasKey(x => x.UserId);

            entity.Property(x => x.UserId)
                .HasColumnName("user_id")
                .ValueGeneratedNever();

            entity.Property(x => x.InterfaceScale)
                .HasColumnName("interface_scale")
                .HasDefaultValue(1.0)
                .IsRequired();

            entity.Property(x => x.FontScale)
                .HasColumnName("font_scale")
                .HasDefaultValue(1.0)
                .IsRequired();

            entity.Property(x => x.ServerInterfaceScale)
                .HasColumnName("server_interface_scale")
                .HasDefaultValue(1.0)
                .IsRequired();

            entity.Property(x => x.IsServerRailPinned)
                .HasColumnName("is_server_rail_pinned")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(x => x.ShowPrivateReadAllButton)
                .HasColumnName("show_private_read_all_button")
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(x => x.IsAllPrivateSpaceOrderLocked)
                .HasColumnName("is_all_private_space_order_locked")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(x => x.ServerMessageDisplayFormat)
                .HasColumnName("server_message_display_format")
                .HasMaxLength(16)
                .HasDefaultValue(MessageDisplayFormatCodes.WallScroll)
                .IsRequired();

            entity.Property(x => x.PrivateMessageDisplayFormat)
                .HasColumnName("private_message_display_format")
                .HasMaxLength(16)
                .HasDefaultValue(MessageDisplayFormatCodes.WallScroll)
                .IsRequired();

            entity.Property(x => x.ServerMessageBubbleAlignment)
                .HasColumnName("server_message_bubble_alignment")
                .HasMaxLength(20)
                .HasDefaultValue(MessageBubbleAlignmentCodes.OwnRight)
                .IsRequired();

            entity.Property(x => x.PrivateMessageBubbleAlignment)
                .HasColumnName("private_message_bubble_alignment")
                .HasMaxLength(20)
                .HasDefaultValue(MessageBubbleAlignmentCodes.OwnRight)
                .IsRequired();

            entity.Property(x => x.ServerMessageBubbleWidth)
                .HasColumnName("server_message_bubble_width")
                .HasMaxLength(16)
                .HasDefaultValue(MessageBubbleWidthCodes.Standard)
                .IsRequired();

            entity.Property(x => x.PrivateMessageBubbleWidth)
                .HasColumnName("private_message_bubble_width")
                .HasMaxLength(16)
                .HasDefaultValue(MessageBubbleWidthCodes.Standard)
                .IsRequired();

            entity.Property(x => x.LoadExternalMediaPreviews)
                .HasColumnName("load_external_media_previews")
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(x => x.HorizontalVideoCardSize)
                .HasColumnName("horizontal_video_card_size")
                .HasDefaultValue(3)
                .IsRequired();

            entity.Property(x => x.VerticalVideoCardSize)
                .HasColumnName("vertical_video_card_size")
                .HasDefaultValue(3)
                .IsRequired();

            entity.Property(x => x.SelectedThemeId)
                .HasColumnName("selected_theme_id")
                .HasDefaultValue(SystemThemeIds.Sapphire)
                .IsRequired();

            entity.Property(x => x.ProfileColor)
                .HasColumnName("profile_color")
                .HasMaxLength(16);

            entity.Property(x => x.ProfileBackgroundAssetId)
                .HasColumnName("profile_background_asset_id");

            entity.Property(x => x.ApplySystemThemeToOtherProfiles)
                .HasColumnName("apply_system_theme_to_other_profiles")
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(x => x.DirectMessagePermission)
                .HasColumnName("direct_message_permission")
                .HasMaxLength(64)
                .HasDefaultValue(DirectMessagePrivacyCodes.Everyone)
                .IsRequired();

            entity.Property(x => x.PresenceVisibility)
                .HasColumnName("presence_visibility")
                .HasMaxLength(64)
                .HasDefaultValue(PresenceVisibilityCodes.Everyone)
                .IsRequired();

            entity.Property(x => x.ShowLastSeen)
                .HasColumnName("show_last_seen")
                .HasDefaultValue(true)
                .IsRequired();

            entity.Property(x => x.PresenceMode)
                .HasColumnName("presence_mode")
                .HasMaxLength(16)
                .HasDefaultValue(PresenceModeCodes.Automatic)
                .IsRequired();

            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(x => x.User)
                .WithOne(x => x.ProfileSettings)
                .HasForeignKey<UserProfileSettings>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.SelectedTheme)
                .WithMany(x => x.ProfileSettings)
                .HasForeignKey(x => x.SelectedThemeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ProfileBackgroundAsset)
                .WithMany()
                .HasForeignKey(x => x.ProfileBackgroundAssetId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
