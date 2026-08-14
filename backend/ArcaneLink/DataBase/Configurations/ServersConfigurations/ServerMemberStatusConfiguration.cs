using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ServersConfigurations
{
    public class ServerMemberStatusConfiguration : IEntityTypeConfiguration<ServerMemberStatus>
    {
        public void Configure(EntityTypeBuilder<ServerMemberStatus> entity)
        {
            entity.ToTable("server_member_statuses");

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
                .HasDatabaseName("UX_ServerMemberStatuses_Code");

            entity.HasData(
                new ServerMemberStatus
                {
                    Id = ServerMemberStatusIds.Active,
                    Code = "active",
                    Title = "Active"
                },
                new ServerMemberStatus
                {
                    Id = ServerMemberStatusIds.Left,
                    Code = "left",
                    Title = "Left"
                },
                new ServerMemberStatus
                {
                    Id = ServerMemberStatusIds.Removed,
                    Code = "removed",
                    Title = "Removed"
                },
                new ServerMemberStatus
                {
                    Id = ServerMemberStatusIds.Banned,
                    Code = "banned",
                    Title = "Banned"
                });
        }
    }
}
