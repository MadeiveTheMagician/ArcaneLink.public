using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ServersConfigurations;

public class ServerInviteKindConfiguration : IEntityTypeConfiguration<ServerInviteKind>
{
    public void Configure(EntityTypeBuilder<ServerInviteKind> entity)
    {
        entity.ToTable("server_invite_kinds");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(32).IsRequired();
        entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(64).IsRequired();
        entity.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UX_ServerInviteKinds_Code");
        entity.HasData(
            new ServerInviteKind { Id = ServerGovernanceIds.InviteKindLink, Code = "link", Title = "Link" },
            new ServerInviteKind { Id = ServerGovernanceIds.InviteKindDirect, Code = "direct", Title = "Direct" });
    }
}

public class ServerInviteConfiguration : IEntityTypeConfiguration<ServerInvite>
{
    public void Configure(EntityTypeBuilder<ServerInvite> entity)
    {
        entity.ToTable("server_invites");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.ServerId).HasColumnName("server_id").IsRequired();
        entity.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
        entity.Property(x => x.KindId).HasColumnName("kind_id").IsRequired();
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(64);
        entity.Property(x => x.TargetUserId).HasColumnName("target_user_id");
        entity.Property(x => x.MaxUses).HasColumnName("max_uses");
        entity.Property(x => x.UsedCount).HasColumnName("used_count").HasDefaultValue(0).IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
        entity.Property(x => x.RevokedByUserId).HasColumnName("revoked_by_user_id");
        entity.HasIndex(x => new { x.ServerId, x.CreatedAt }).HasDatabaseName("IX_ServerInvites_Server_Time");
        entity.HasIndex(x => new { x.TargetUserId, x.CreatedAt }).HasDatabaseName("IX_ServerInvites_Target_Time");
        entity.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UX_ServerInvites_Code");
        entity.HasOne(x => x.Server).WithMany(x => x.Invites).HasForeignKey(x => x.ServerId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Kind).WithMany().HasForeignKey(x => x.KindId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.TargetUser).WithMany().HasForeignKey(x => x.TargetUserId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.RevokedByUser).WithMany().HasForeignKey(x => x.RevokedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ServerInviteUsageConfiguration : IEntityTypeConfiguration<ServerInviteUsage>
{
    public void Configure(EntityTypeBuilder<ServerInviteUsage> entity)
    {
        entity.ToTable("server_invite_usages");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.InviteId).HasColumnName("invite_id").IsRequired();
        entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.UsedAt).HasColumnName("used_at").IsRequired();
        entity.HasIndex(x => new { x.InviteId, x.UsedAt }).HasDatabaseName("IX_ServerInviteUsages_Invite_Time");
        entity.HasIndex(x => new { x.UserId, x.UsedAt }).HasDatabaseName("IX_ServerInviteUsages_User_Time");
        entity.HasIndex(x => new { x.InviteId, x.UserId }).IsUnique().HasDatabaseName("UX_ServerInviteUsages_Invite_User");
        entity.HasOne(x => x.Invite).WithMany(x => x.Usages).HasForeignKey(x => x.InviteId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ServerOwnershipTransferTypeConfiguration : IEntityTypeConfiguration<ServerOwnershipTransferType>
{
    public void Configure(EntityTypeBuilder<ServerOwnershipTransferType> entity)
    {
        entity.ToTable("server_ownership_transfer_types");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(32).IsRequired();
        entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(64).IsRequired();
        entity.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UX_ServerOwnershipTransferTypes_Code");
        entity.HasData(
            new ServerOwnershipTransferType { Id = ServerGovernanceIds.OwnershipTransferVoluntary, Code = "voluntary", Title = "Voluntary" },
            new ServerOwnershipTransferType { Id = ServerGovernanceIds.OwnershipTransferForced, Code = "forced", Title = "Forced" },
            new ServerOwnershipTransferType { Id = ServerGovernanceIds.OwnershipTransferRecovery, Code = "recovery", Title = "Recovery" });
    }
}

public class ServerOwnershipTransferConfiguration : IEntityTypeConfiguration<ServerOwnershipTransfer>
{
    public void Configure(EntityTypeBuilder<ServerOwnershipTransfer> entity)
    {
        entity.ToTable("server_ownership_transfers");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.ServerId).HasColumnName("server_id").IsRequired();
        entity.Property(x => x.FromUserId).HasColumnName("from_user_id").IsRequired();
        entity.Property(x => x.ToUserId).HasColumnName("to_user_id").IsRequired();
        entity.Property(x => x.TransferTypeId).HasColumnName("transfer_type_id").IsRequired();
        entity.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(512);
        entity.Property(x => x.ExecutedByUserId).HasColumnName("executed_by_user_id").IsRequired();
        entity.Property(x => x.TransferredAt).HasColumnName("transferred_at").IsRequired();
        entity.HasIndex(x => new { x.ServerId, x.TransferredAt }).HasDatabaseName("IX_ServerOwnershipTransfers_Server_Time");
        entity.HasOne(x => x.Server).WithMany(x => x.OwnershipTransfers).HasForeignKey(x => x.ServerId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.TransferType).WithMany().HasForeignKey(x => x.TransferTypeId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class PermissionCatalogConfiguration : IEntityTypeConfiguration<PermissionCatalog>
{
    public void Configure(EntityTypeBuilder<PermissionCatalog> entity)
    {
        entity.ToTable("permission_catalog");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(64).IsRequired();
        entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(64).IsRequired();
        entity.Property(x => x.Description).HasColumnName("description").HasMaxLength(255);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UX_PermissionCatalog_Code");
        var seededAt = new DateTime(2026, 5, 14, 0, 0, 0, DateTimeKind.Utc);
        entity.HasData(
            new PermissionCatalog { Id = ServerGovernanceIds.PermissionManageServer, Code = "manage_server", Title = "Manage server", CreatedAt = seededAt },
            new PermissionCatalog { Id = ServerGovernanceIds.PermissionManageRoles, Code = "manage_roles", Title = "Manage roles", CreatedAt = seededAt },
            new PermissionCatalog { Id = ServerGovernanceIds.PermissionManageInvites, Code = "manage_invites", Title = "Manage invites", CreatedAt = seededAt },
            new PermissionCatalog { Id = ServerGovernanceIds.PermissionManageMembers, Code = "manage_members", Title = "Manage members", CreatedAt = seededAt },
            new PermissionCatalog { Id = ServerGovernanceIds.PermissionViewAuditLog, Code = "view_audit_log", Title = "View audit log", CreatedAt = seededAt },
            new PermissionCatalog { Id = ServerGovernanceIds.PermissionManageReports, Code = "manage_reports", Title = "Manage reports", CreatedAt = seededAt },
            new PermissionCatalog { Id = SpacePermissionIds.ViewSpace, Code = "view_space", Title = "View space", CreatedAt = seededAt },
            new PermissionCatalog { Id = SpacePermissionIds.SendMessages, Code = "send_messages", Title = "Send messages", CreatedAt = seededAt },
            new PermissionCatalog { Id = SpacePermissionIds.ConnectVoice, Code = "connect_voice", Title = "Connect to voice", CreatedAt = seededAt },
            new PermissionCatalog { Id = SpacePermissionIds.ManageSpace, Code = "manage_space", Title = "Manage space", CreatedAt = seededAt });
    }
}
