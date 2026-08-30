using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ServersConfigurations;

public class ServerMemberConfiguration : IEntityTypeConfiguration<ServerMember>
{
    public void Configure(EntityTypeBuilder<ServerMember> entity)
    {
        entity.ToTable(
            "server_members",
            table => table.HasCheckConstraint(
                "CK_ServerMembers_DisplayColor",
                "(\"display_color_mode\" IN ('auto', 'default') AND \"display_color_role_id\" IS NULL) OR " +
                "(\"display_color_mode\" = 'role' AND \"display_color_role_id\" IS NOT NULL)"));

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(x => x.ServerId)
            .HasColumnName("server_id")
            .IsRequired();

        entity.Property(x => x.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        entity.Property(x => x.StatusId)
            .HasColumnName("status_id")
            .IsRequired();

        entity.Property(x => x.JoinedAt)
            .HasColumnName("joined_at")
            .IsRequired();

        entity.Property(x => x.LeftAt)
            .HasColumnName("left_at");

        entity.Property(x => x.BannedAt)
            .HasColumnName("banned_at");

        entity.Property(x => x.BannedByUserId)
            .HasColumnName("banned_by_user_id");

        entity.Property(x => x.BanReason)
            .HasColumnName("ban_reason")
            .HasMaxLength(ServerBanLimits.ReasonMaxLength);

        entity.Property(x => x.AddedByUserId)
            .HasColumnName("added_by_user_id");

        entity.Property(x => x.DisplayColorMode)
            .HasColumnName("display_color_mode")
            .HasMaxLength(16)
            .HasDefaultValue(ServerMemberDisplayColorModeCodes.Auto)
            .IsRequired();

        entity.Property(x => x.DisplayColorRoleId)
            .HasColumnName("display_color_role_id");

        entity.Property(x => x.RolesVersion)
            .HasColumnName("roles_version")
            .HasDefaultValueSql("gen_random_uuid()")
            .IsRequired();

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        entity.HasIndex(x => new { x.ServerId, x.UserId })
            .IsUnique()
            .HasDatabaseName("UX_ServerMembers_Server_User");

        entity.HasIndex(x => new { x.ServerId, x.Id })
            .IsUnique()
            .HasDatabaseName("UX_ServerMembers_Server_Id");

        entity.HasIndex(x => new { x.UserId, x.StatusId, x.UpdatedAt })
            .HasDatabaseName("IX_ServerMembers_User_Status_Time");

        entity.HasIndex(x => new { x.ServerId, x.StatusId, x.JoinedAt })
            .HasDatabaseName("IX_ServerMembers_Server_Status_Time");

        entity.HasIndex(x => new { x.ServerId, x.StatusId, x.BannedAt })
            .HasDatabaseName("IX_ServerMembers_Server_Status_BannedAt");

        entity.HasIndex(x => new { x.ServerId, x.DisplayColorRoleId })
            .HasFilter("\"display_color_role_id\" IS NOT NULL")
            .HasDatabaseName("IX_ServerMembers_Server_DisplayColorRole");

        entity.HasOne(x => x.Server)
            .WithMany(x => x.Members)
            .HasForeignKey(x => x.ServerId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.User)
            .WithMany(x => x.ServerMemberships)
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

        entity.HasOne(x => x.BannedByUser)
            .WithMany()
            .HasForeignKey(x => x.BannedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.DisplayColorRole)
            .WithMany()
            .HasForeignKey(x => x.DisplayColorRoleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
