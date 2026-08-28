using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ServersConfigurations;

public class ServerRoleConfiguration : IEntityTypeConfiguration<ServerRole>
{
    public void Configure(EntityTypeBuilder<ServerRole> entity)
    {
        entity.ToTable(
            "server_roles",
            table =>
            {
                table.HasCheckConstraint(
                    "CK_ServerRoles_Kind",
                    "\"kind\" IN ('standard', 'everyone', 'integration')");
                table.HasCheckConstraint(
                    "CK_ServerRoles_PermissionMaskLength",
                    "length(\"permission_mask\") = 32");
                table.HasCheckConstraint(
                    "CK_ServerRoles_PermissionSchemaVersion",
                    "\"permission_schema_version\" = 1");
            });
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.ServerId).HasColumnName("server_id").IsRequired();
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(32);
        entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(64).IsRequired();
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(255);
        entity.Property(x => x.Kind)
            .HasColumnName("kind")
            .HasMaxLength(16)
            .HasDefaultValue(ServerRoleKindCodes.Standard)
            .IsRequired();
        entity.Property(x => x.Color).HasColumnName("color").HasMaxLength(9);
        entity.Property(x => x.Mentionable)
            .HasColumnName("mentionable")
            .HasDefaultValue(false)
            .IsRequired();
        entity.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
        entity.Property(x => x.Level).HasColumnName("level").IsRequired();
        entity.Property(x => x.IsSystem).HasColumnName("is_system").HasDefaultValue(false).IsRequired();
        entity.Property(x => x.PermissionMask)
            .HasColumnName("permission_mask")
            .HasColumnType("bytea")
            .HasDefaultValue(new byte[32])
            .IsRequired();
        entity.Property(x => x.PermissionSchemaVersion)
            .HasColumnName("permission_schema_version")
            .HasDefaultValue(1)
            .IsRequired();
        entity.Property(x => x.Version)
            .HasColumnName("version")
            .HasDefaultValueSql("gen_random_uuid()")
            .IsConcurrencyToken()
            .IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").IsRequired();
        entity.Property(x => x.DeletedAt).HasColumnName("deleted_at");
        entity.HasIndex(x => new { x.ServerId, x.Code }).IsUnique().HasDatabaseName("UX_ServerRoles_Server_Code");
        entity.HasIndex(x => new { x.ServerId, x.Title }).IsUnique().HasDatabaseName("UX_ServerRoles_Server_Title");
        entity.HasIndex(x => new { x.ServerId, x.Id }).IsUnique().HasDatabaseName("UX_ServerRoles_Server_Id");
        entity.HasIndex(x => new { x.ServerId, x.Level }).HasDatabaseName("IX_ServerRoles_Server_Level");
        entity.HasOne(x => x.Server).WithMany(x => x.Roles).HasForeignKey(x => x.ServerId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.CreatedByUser)
            .WithMany()
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ServerRolePermissionConfiguration : IEntityTypeConfiguration<ServerRolePermission>
{
    public void Configure(EntityTypeBuilder<ServerRolePermission> entity)
    {
        entity.ToTable("server_role_permissions");
        entity.HasKey(x => new { x.RoleId, x.PermissionId });
        entity.Property(x => x.RoleId).HasColumnName("role_id").IsRequired();
        entity.Property(x => x.PermissionId).HasColumnName("permission_id").IsRequired();
        entity.Property(x => x.IsGranted).HasColumnName("is_granted").HasDefaultValue(true).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasIndex(x => new { x.RoleId, x.PermissionId }).IsUnique().HasDatabaseName("UX_ServerRolePermissions_Role_Permission");
        entity.HasIndex(x => new { x.PermissionId, x.RoleId }).HasDatabaseName("IX_ServerRolePermissions_Permission_Role");
        entity.HasOne(x => x.Role).WithMany(x => x.Permissions).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Permission).WithMany().HasForeignKey(x => x.PermissionId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ServerMemberRoleConfiguration : IEntityTypeConfiguration<ServerMemberRole>
{
    public void Configure(EntityTypeBuilder<ServerMemberRole> entity)
    {
        entity.ToTable("server_member_roles");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.ServerId).HasColumnName("server_id").IsRequired();
        entity.Property(x => x.MemberId).HasColumnName("member_id").IsRequired();
        entity.Property(x => x.RoleId).HasColumnName("role_id").IsRequired();
        entity.Property(x => x.AssignedByUserId).HasColumnName("assigned_by_user_id");
        entity.Property(x => x.AssignedAt).HasColumnName("assigned_at").IsRequired();
        entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
        entity.Property(x => x.RevokedByUserId).HasColumnName("revoked_by_user_id");
        entity.HasIndex(x => new { x.ServerId, x.MemberId, x.RoleId }).IsUnique().HasDatabaseName("UX_ServerMemberRoles_Server_Member_Role");
        entity.HasIndex(x => new { x.ServerId, x.MemberId }).HasDatabaseName("IX_ServerMemberRoles_Server_Member");
        entity.HasIndex(x => new { x.ServerId, x.RoleId }).HasDatabaseName("IX_ServerMemberRoles_Server_Role");
        entity.HasOne(x => x.Server).WithMany().HasForeignKey(x => x.ServerId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Member).WithMany(x => x.Roles).HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Role).WithMany(x => x.MemberRoles).HasForeignKey(x => x.RoleId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ServerAuditEventTypeConfiguration : IEntityTypeConfiguration<ServerAuditEventType>
{
    public void Configure(EntityTypeBuilder<ServerAuditEventType> entity)
    {
        entity.ToTable("server_audit_event_types");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(64).IsRequired();
        entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(64).IsRequired();
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(255);
        entity.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UX_ServerAuditEventTypes_Code");
        entity.HasData(
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditMemberJoined, Code = "member_joined", Title = "Member joined" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditMemberLeft, Code = "member_left", Title = "Member left" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditMemberRemoved, Code = "member_removed", Title = "Member removed" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditOwnershipTransferred, Code = "ownership_transferred", Title = "Ownership transferred" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditInviteCreated, Code = "invite_created", Title = "Invite created" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditInviteRevoked, Code = "invite_revoked", Title = "Invite revoked" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditRoleCreated, Code = "role_created", Title = "Role created" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditRoleUpdated, Code = "role_updated", Title = "Role updated" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditRoleAssigned, Code = "role_assigned", Title = "Role assigned" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditRoleRevoked, Code = "role_revoked", Title = "Role revoked" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditSpaceCreated, Code = "space_created", Title = "Space created" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditSpaceUpdated, Code = "space_updated", Title = "Space updated" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditSpaceDeleted, Code = "space_deleted", Title = "Space deleted" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditSpacesReordered, Code = "spaces_reordered", Title = "Spaces reordered" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditSpaceOverrideUpserted, Code = "space_override_upserted", Title = "Space override upserted" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditSpaceOverrideDeleted, Code = "space_override_deleted", Title = "Space override deleted" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditMemberBanned, Code = "member_banned", Title = "Member banned" },
            new ServerAuditEventType { Id = ServerGovernanceIds.AuditMemberUnbanned, Code = "member_unbanned", Title = "Member unbanned" });
    }
}

public class ServerAuditLogConfiguration : IEntityTypeConfiguration<ServerAuditLog>
{
    public void Configure(EntityTypeBuilder<ServerAuditLog> entity)
    {
        entity.ToTable("server_audit_logs");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.ServerId).HasColumnName("server_id").IsRequired();
        entity.Property(x => x.EventTypeId).HasColumnName("event_type_id").IsRequired();
        entity.Property(x => x.ActorUserId).HasColumnName("actor_user_id");
        entity.Property(x => x.TargetUserId).HasColumnName("target_user_id");
        entity.Property(x => x.RelatedRoleId).HasColumnName("related_role_id");
        entity.Property(x => x.RelatedInviteId).HasColumnName("related_invite_id");
        entity.Property(x => x.RelatedSpaceId).HasColumnName("related_space_id");
        entity.Property(x => x.Payload).HasColumnName("payload").HasColumnType("jsonb");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasIndex(x => new { x.ServerId, x.CreatedAt }).HasDatabaseName("IX_ServerAuditLogs_Server_Time");
        entity.HasIndex(x => new { x.EventTypeId, x.CreatedAt }).HasDatabaseName("IX_ServerAuditLogs_Type_Time");
        entity.HasIndex(x => new { x.ActorUserId, x.CreatedAt }).HasDatabaseName("IX_ServerAuditLogs_Actor_Time");
        entity.HasIndex(x => new { x.TargetUserId, x.CreatedAt }).HasDatabaseName("IX_ServerAuditLogs_Target_Time");
        entity.HasOne(x => x.Server).WithMany(x => x.AuditLogs).HasForeignKey(x => x.ServerId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.EventType).WithMany().HasForeignKey(x => x.EventTypeId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.RelatedSpace).WithMany().HasForeignKey(x => x.RelatedSpaceId).OnDelete(DeleteBehavior.SetNull);
    }
}
