using ArcaneLink.DataBase.Models.SpacesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.SpacesConfigurations;

public class SpaceConfiguration : IEntityTypeConfiguration<Space>
{
    public void Configure(EntityTypeBuilder<Space> entity)
    {
        entity.ToTable(
            "spaces",
            table => table.HasCheckConstraint(
                "CK_Spaces_ServerRoleScope",
                "\"server_id\" IS NOT NULL OR " +
                "(\"required_server_role_id\" IS NULL AND " +
                "\"created_with_role_id\" IS NULL AND " +
                "\"protection_role_id\" IS NULL)"));

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(x => x.ServerId)
            .HasColumnName("server_id");

        entity.Property(x => x.TypeId)
            .HasColumnName("type_id")
            .IsRequired();

        entity.Property(x => x.ParentSpaceId)
            .HasColumnName("parent_space_id");

        entity.Property(x => x.ParentVoiceSpaceId)
            .HasColumnName("parent_voice_space_id");

        entity.Property(x => x.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        entity.Property(x => x.Title)
            .HasColumnName("title")
            .HasMaxLength(128)
            .IsRequired();

        entity.Property(x => x.Description)
            .HasColumnName("description")
            .HasMaxLength(512);

        entity.Property(x => x.RequiredServerRoleId)
            .HasColumnName("required_server_role_id");

        entity.Property(x => x.CreatedWithRoleId)
            .HasColumnName("created_with_role_id");

        entity.Property(x => x.ProtectionRoleId)
            .HasColumnName("protection_role_id");

        entity.Property(x => x.Position)
            .HasColumnName("position")
            .HasDefaultValue(0)
            .IsRequired();

        entity.Property(x => x.IsSystem)
            .HasColumnName("is_system")
            .HasDefaultValue(false)
            .IsRequired();

        entity.Property(x => x.Version)
            .HasColumnName("version")
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

        entity.HasIndex(x => new { x.ServerId, x.Position })
            .HasDatabaseName("IX_Spaces_Server_Position");

        entity.HasIndex(x => new { x.ServerId, x.Id })
            .IsUnique()
            .HasDatabaseName("UX_Spaces_Server_Id");

        entity.HasIndex(x => new { x.ServerId, x.ParentSpaceId, x.Position })
            .HasDatabaseName("IX_Spaces_Hierarchy_Position");

        entity.HasIndex(x => x.ParentVoiceSpaceId)
            .IsUnique()
            .HasFilter("parent_voice_space_id IS NOT NULL")
            .HasDatabaseName("IX_Spaces_ParentVoiceSpace_Unique");

        entity.HasIndex(x => new { x.ServerId, x.TypeId, x.CreatedAt })
            .HasDatabaseName("IX_Spaces_Server_Type_Time");

        entity.HasIndex(x => new { x.ServerId, x.RequiredServerRoleId, x.CreatedAt })
            .HasDatabaseName("IX_Spaces_Server_RequiredRole_Time");

        entity.HasIndex(x => new { x.ServerId, x.CreatedWithRoleId })
            .HasFilter("\"created_with_role_id\" IS NOT NULL")
            .HasDatabaseName("IX_Spaces_Server_CreatedWithRole");

        entity.HasIndex(x => new { x.ServerId, x.ProtectionRoleId })
            .HasFilter("\"protection_role_id\" IS NOT NULL")
            .HasDatabaseName("IX_Spaces_Server_ProtectionRole");

        entity.HasIndex(x => new { x.CreatedByUserId, x.CreatedAt })
            .HasDatabaseName("IX_Spaces_Creator_Time");

        entity.HasOne(x => x.Server)
            .WithMany(x => x.Spaces)
            .HasForeignKey(x => x.ServerId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.Type)
            .WithMany(x => x.Spaces)
            .HasForeignKey(x => x.TypeId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.ParentSpace)
            .WithMany(x => x.ChildSpaces)
            .HasForeignKey(x => x.ParentSpaceId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.ParentVoiceSpace)
            .WithOne(x => x.VoiceChatSpace)
            .HasForeignKey<Space>(x => x.ParentVoiceSpaceId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.RequiredServerRole)
            .WithMany()
            .HasForeignKey(x => x.RequiredServerRoleId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(x => x.CreatedWithRole)
            .WithMany()
            .HasForeignKey(x => x.CreatedWithRoleId)
            .OnDelete(DeleteBehavior.SetNull);

        entity.HasOne(x => x.ProtectionRole)
            .WithMany()
            .HasForeignKey(x => x.ProtectionRoleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
