using ArcaneLink.DataBase.Models.SpacesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.SpacesConfigurations
{
    public class SpacePermissionOverrideConfiguration
        : IEntityTypeConfiguration<SpacePermissionOverride>
    {
        public void Configure(EntityTypeBuilder<SpacePermissionOverride> entity)
        {
            entity.ToTable(
                "space_permission_overrides",
                table =>
                {
                    table.HasCheckConstraint(
                        "CK_SpacePermissionOverrides_Target",
                        "(role_id IS NOT NULL AND member_id IS NULL) OR (role_id IS NULL AND member_id IS NOT NULL)");
                    table.HasCheckConstraint(
                        "CK_SpacePermissionOverrides_Effect",
                        "allow <> deny");
                });

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            entity.Property(x => x.ServerId)
                .HasColumnName("server_id")
                .IsRequired();

            entity.Property(x => x.SpaceId)
                .HasColumnName("space_id")
                .IsRequired();

            entity.Property(x => x.RoleId)
                .HasColumnName("role_id");

            entity.Property(x => x.MemberId)
                .HasColumnName("member_id");

            entity.Property(x => x.PermissionId)
                .HasColumnName("permission_id")
                .IsRequired();

            entity.Property(x => x.Allow)
                .HasColumnName("allow")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(x => x.Deny)
                .HasColumnName("deny")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(x => x.CreatedByUserId)
                .HasColumnName("created_by_user_id");

            entity.Property(x => x.ProtectionRoleId)
                .HasColumnName("protection_role_id");

            entity.Property(x => x.Version)
                .HasColumnName("version")
                .HasDefaultValueSql("gen_random_uuid()")
                .IsRequired();

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasIndex(x => new { x.SpaceId, x.RoleId, x.PermissionId })
                .IsUnique()
                .HasFilter("\"role_id\" IS NOT NULL")
                .HasDatabaseName("IX_SpaceOverrides_Role");

            entity.HasIndex(x => new { x.SpaceId, x.MemberId, x.PermissionId })
                .IsUnique()
                .HasFilter("\"member_id\" IS NOT NULL")
                .HasDatabaseName("IX_SpaceOverrides_Member");

            entity.HasIndex(x => new { x.RoleId, x.PermissionId })
                .HasDatabaseName("IX_SpaceOverrides_Role_Perm");

            entity.HasIndex(x => new { x.MemberId, x.PermissionId })
                .HasDatabaseName("IX_SpaceOverrides_Member_Perm");

            entity.HasIndex(x => new { x.ServerId, x.SpaceId })
                .HasDatabaseName("IX_SpaceOverrides_Server_Space");

            entity.HasIndex(x => new { x.ServerId, x.ProtectionRoleId })
                .HasFilter("\"protection_role_id\" IS NOT NULL")
                .HasDatabaseName("IX_SpaceOverrides_Server_ProtectionRole");

            entity.HasOne(x => x.Space)
                .WithMany(x => x.PermissionOverrides)
                .HasForeignKey(x => x.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Server)
                .WithMany()
                .HasForeignKey(x => x.ServerId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Role)
                .WithMany()
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Member)
                .WithMany()
                .HasForeignKey(x => x.MemberId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Permission)
                .WithMany()
                .HasForeignKey(x => x.PermissionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ProtectionRole)
                .WithMany()
                .HasForeignKey(x => x.ProtectionRoleId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
