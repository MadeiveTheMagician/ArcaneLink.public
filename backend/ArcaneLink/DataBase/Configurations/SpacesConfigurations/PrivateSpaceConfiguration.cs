using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.SpacesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.SpacesConfigurations;

public class PrivateSpaceConfiguration : IEntityTypeConfiguration<PrivateSpace>
{
    public void Configure(EntityTypeBuilder<PrivateSpace> entity)
    {
        entity.ToTable("private_spaces");

        entity.HasKey(x => x.SpaceId);

        entity.Property(x => x.SpaceId)
            .HasColumnName("space_id")
            .ValueGeneratedNever();

        entity.Property(x => x.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        entity.Property(x => x.OwnerUserId)
            .HasColumnName("owner_user_id")
            .IsRequired();

        entity.Property(x => x.Kind)
            .HasColumnName("kind")
            .HasMaxLength(16)
            .IsRequired();

        entity.Property(x => x.DirectUserLowId)
            .HasColumnName("direct_user_low_id");

        entity.Property(x => x.DirectUserHighId)
            .HasColumnName("direct_user_high_id");

        entity.Property(x => x.Title)
            .HasColumnName("title")
            .HasMaxLength(128);

        entity.Property(x => x.Description)
            .HasColumnName("description")
            .HasMaxLength(512);

        entity.Property(x => x.AvatarAssetId)
            .HasColumnName("avatar_asset_id");

        entity.Property(x => x.AvatarCropOffsetX)
            .HasColumnName("avatar_crop_offset_x")
            .HasDefaultValue(0d)
            .IsRequired();

        entity.Property(x => x.AvatarCropOffsetY)
            .HasColumnName("avatar_crop_offset_y")
            .HasDefaultValue(0d)
            .IsRequired();

        entity.Property(x => x.AvatarCropZoom)
            .HasColumnName("avatar_crop_zoom")
            .HasDefaultValue(1d)
            .IsRequired();

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        entity.Property(x => x.DeletedAt)
            .HasColumnName("deleted_at");

        entity.HasIndex(x => new { x.CreatedByUserId, x.CreatedAt })
            .HasDatabaseName("IX_PrivateSpaces_Creator_Time");

        entity.HasIndex(x => new { x.DirectUserLowId, x.DirectUserHighId })
            .IsUnique()
            .HasFilter("\"direct_user_low_id\" IS NOT NULL AND \"direct_user_high_id\" IS NOT NULL")
            .HasDatabaseName("UX_PrivateSpaces_DirectPair");

        entity.ToTable(table => table.HasCheckConstraint(
            "CK_PrivateSpaces_DirectPair",
            "(kind = 'direct' AND direct_user_low_id IS NOT NULL AND direct_user_high_id IS NOT NULL AND direct_user_low_id < direct_user_high_id) OR (kind = 'group' AND direct_user_low_id IS NULL AND direct_user_high_id IS NULL)"));

        entity.HasOne(x => x.Space)
            .WithOne(x => x.PrivateSpace)
            .HasForeignKey<PrivateSpace>(x => x.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.OwnerUser)
            .WithMany()
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.DirectUserLow)
            .WithMany()
            .HasForeignKey(x => x.DirectUserLowId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.DirectUserHigh)
            .WithMany()
            .HasForeignKey(x => x.DirectUserHighId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.AvatarAsset)
            .WithMany()
            .HasForeignKey(x => x.AvatarAssetId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class PrivateSpaceMemberStatusConfiguration
    : IEntityTypeConfiguration<PrivateSpaceMemberStatus>
{
    public void Configure(EntityTypeBuilder<PrivateSpaceMemberStatus> entity)
    {
        entity.ToTable("private_space_member_statuses");

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

        entity.HasIndex(x => x.Code)
            .IsUnique()
            .HasDatabaseName("UX_PrivateSpaceMemberStatuses_Code");

        entity.HasData(
            new PrivateSpaceMemberStatus
            {
                Id = PrivateSpaceIds.MemberStatusActive,
                Code = "active",
                Title = "Active"
            },
            new PrivateSpaceMemberStatus
            {
                Id = PrivateSpaceIds.MemberStatusLeft,
                Code = "left",
                Title = "Left"
            },
            new PrivateSpaceMemberStatus
            {
                Id = PrivateSpaceIds.MemberStatusRemoved,
                Code = "removed",
                Title = "Removed"
            });
    }
}

public class PrivateSpaceMemberConfiguration
    : IEntityTypeConfiguration<PrivateSpaceMember>
{
    public void Configure(EntityTypeBuilder<PrivateSpaceMember> entity)
    {
        entity.ToTable("private_space_members");

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(x => x.SpaceId)
            .HasColumnName("space_id")
            .IsRequired();

        entity.Property(x => x.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        entity.Property(x => x.StatusId)
            .HasColumnName("status_id")
            .IsRequired();

        entity.Property(x => x.ListPosition)
            .HasColumnName("list_position")
            .IsRequired();

        entity.Property(x => x.ListActivityAt)
            .HasColumnName("list_activity_at")
            .IsRequired();

        entity.Property(x => x.PinnedAt)
            .HasColumnName("pinned_at");

        entity.Property(x => x.Note)
            .HasColumnName("note")
            .HasMaxLength(64);

        entity.Property(x => x.PeerNickname)
            .HasColumnName("peer_nickname")
            .HasMaxLength(64);

        entity.Property(x => x.PeerAvatarAssetId)
            .HasColumnName("peer_avatar_asset_id");

        entity.Property(x => x.PeerAvatarCropOffsetX)
            .HasColumnName("peer_avatar_crop_offset_x")
            .HasDefaultValue(0d)
            .IsRequired();

        entity.Property(x => x.PeerAvatarCropOffsetY)
            .HasColumnName("peer_avatar_crop_offset_y")
            .HasDefaultValue(0d)
            .IsRequired();

        entity.Property(x => x.PeerAvatarCropZoom)
            .HasColumnName("peer_avatar_crop_zoom")
            .HasDefaultValue(1d)
            .IsRequired();

        entity.Property(x => x.MutedUntil)
            .HasColumnName("muted_until");

        entity.Property(x => x.IsMutedIndefinitely)
            .HasColumnName("is_muted_indefinitely")
            .HasDefaultValue(false)
            .IsRequired();

        entity.Property(x => x.HistoryClearedAt)
            .HasColumnName("history_cleared_at");

        entity.Property(x => x.HiddenFromListAt)
            .HasColumnName("hidden_from_list_at");

        entity.Property(x => x.JoinedAt)
            .HasColumnName("joined_at")
            .IsRequired();

        entity.Property(x => x.LeftAt)
            .HasColumnName("left_at");

        entity.Property(x => x.AddedByUserId)
            .HasColumnName("added_by_user_id");

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        entity.HasIndex(x => new { x.SpaceId, x.UserId })
            .IsUnique()
            .HasDatabaseName("UX_PrivateSpaceMembers_Space_User");

        entity.HasIndex(x => new { x.SpaceId, x.Id })
            .IsUnique()
            .HasDatabaseName("UX_PrivateSpaceMembers_Space_Id");

        entity.HasIndex(x => new { x.UserId, x.StatusId, x.UpdatedAt })
            .HasDatabaseName("IX_PrivateSpaceMembers_User_Status_Time");

        entity.HasIndex(x => new { x.UserId, x.StatusId, x.ListPosition })
            .HasDatabaseName("IX_PrivateSpaceMembers_User_Status_ListPosition");

        entity.HasIndex(x => new
        {
            x.UserId,
            x.StatusId,
            x.HiddenFromListAt,
            x.ListActivityAt
        })
            .HasDatabaseName(
                "IX_PrivateSpaceMembers_User_Status_Visibility_Activity");

        entity.HasIndex(x => new { x.UserId, x.StatusId, x.PinnedAt })
            .HasDatabaseName("IX_PrivateSpaceMembers_User_Status_PinnedAt");

        entity.HasIndex(x => new { x.SpaceId, x.StatusId, x.JoinedAt })
            .HasDatabaseName("IX_PrivateSpaceMembers_Space_Status_Time");

        entity.ToTable(table => table.HasCheckConstraint(
            "CK_PrivateSpaceMembers_Mute",
            "NOT (is_muted_indefinitely AND muted_until IS NOT NULL)"));

        entity.HasOne(x => x.PrivateSpace)
            .WithMany(x => x.Members)
            .HasForeignKey(x => x.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.Status)
            .WithMany()
            .HasForeignKey(x => x.StatusId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.AddedByUser)
            .WithMany()
            .HasForeignKey(x => x.AddedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.PeerAvatarAsset)
            .WithMany()
            .HasForeignKey(x => x.PeerAvatarAssetId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
