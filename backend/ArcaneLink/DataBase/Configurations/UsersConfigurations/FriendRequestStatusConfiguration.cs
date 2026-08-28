using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations;

public class FriendRequestStatusConfiguration : IEntityTypeConfiguration<FriendRequestStatus>
{
    public void Configure(EntityTypeBuilder<FriendRequestStatus> entity)
    {
        entity.ToTable("friend_request_statuses");

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
            .HasDatabaseName("UX_FriendRequestStatuses_Code");

        entity.HasData(
            new FriendRequestStatus
            {
                Id = FriendRequestStatusIds.Pending,
                Code = "pending",
                Title = "Pending"
            },
            new FriendRequestStatus
            {
                Id = FriendRequestStatusIds.Accepted,
                Code = "accepted",
                Title = "Accepted"
            },
            new FriendRequestStatus
            {
                Id = FriendRequestStatusIds.Declined,
                Code = "declined",
                Title = "Declined"
            },
            new FriendRequestStatus
            {
                Id = FriendRequestStatusIds.Canceled,
                Code = "canceled",
                Title = "Canceled"
            });
    }
}
