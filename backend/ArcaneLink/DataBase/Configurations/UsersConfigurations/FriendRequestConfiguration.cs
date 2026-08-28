using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations;

public class FriendRequestConfiguration : IEntityTypeConfiguration<FriendRequest>
{
    public void Configure(EntityTypeBuilder<FriendRequest> entity)
    {
        entity.ToTable("friend_requests");

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(x => x.FromUserId)
            .HasColumnName("from_user_id")
            .IsRequired();

        entity.Property(x => x.ToUserId)
            .HasColumnName("to_user_id")
            .IsRequired();

        entity.Property(x => x.StatusId)
            .HasColumnName("status_id")
            .IsRequired();

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        entity.Property(x => x.RespondedAt)
            .HasColumnName("responded_at");

        entity.HasIndex(x => new { x.FromUserId, x.ToUserId, x.StatusId })
            .HasDatabaseName("IX_FriendRequests_From_To_Status");

        entity.HasIndex(x => new { x.ToUserId, x.StatusId, x.CreatedAt })
            .HasDatabaseName("IX_FriendRequests_To_Status_Time");

        entity.HasIndex(x => new { x.FromUserId, x.StatusId, x.CreatedAt })
            .HasDatabaseName("IX_FriendRequests_From_Status_Time");

        entity.HasOne(x => x.FromUser)
            .WithMany(x => x.SentFriendRequests)
            .HasForeignKey(x => x.FromUserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.ToUser)
            .WithMany(x => x.ReceivedFriendRequests)
            .HasForeignKey(x => x.ToUserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.Status)
            .WithMany()
            .HasForeignKey(x => x.StatusId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
