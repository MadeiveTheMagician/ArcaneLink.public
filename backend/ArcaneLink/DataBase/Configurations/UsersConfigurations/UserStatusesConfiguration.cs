using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations;

public class UserStatusesConfiguration : IEntityTypeConfiguration<UserStatus>
{
    public void Configure(EntityTypeBuilder<UserStatus> entity)
    {
        entity.ToTable("user_statuses");

        entity.HasKey(e => e.Id);

        entity.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(e => e.Code)
            .HasColumnName("code")
            .HasMaxLength(32)
            .IsRequired();

        entity.Property(e => e.Title)
            .HasColumnName("title")
            .HasMaxLength(64)
            .IsRequired();

        entity.HasIndex(e => e.Code)
            .IsUnique()
            .HasDatabaseName("UX_UserStatuses_Code");

        // Seed data: системные статусы пользователей.
        // Используются фиксированные GUID, чтобы не ломались связи и миграции.

        entity.HasData(
            new UserStatus
            {
                Id = UserStatusIds.Active,
                Code = "active",
                Title = "Active"
            },
            new UserStatus
            {
                Id = UserStatusIds.Banned,
                Code = "banned",
                Title = "Banned"
            },
            new UserStatus
            {
                Id = UserStatusIds.Deleted,
                Code = "deleted",
                Title = "Deleted"
            },
            new UserStatus
            {
                Id = UserStatusIds.PendingEmailVerification,
                Code = "pending_email_verification",
                Title = "Pending email verification"
            }

        );
    }
}
