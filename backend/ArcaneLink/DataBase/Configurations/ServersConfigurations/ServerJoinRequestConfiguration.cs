using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ServersConfigurations
{
    public class ServerJoinRequestConfiguration
        : IEntityTypeConfiguration<ServerJoinRequest>
    {
        public void Configure(EntityTypeBuilder<ServerJoinRequest> entity)
        {
            entity.ToTable(
                "server_join_requests",
                table => table.HasCheckConstraint(
                    "CK_ServerJoinRequests_StatusCode",
                    "\"status_code\" IN ('pending', 'approved', 'declined', 'cancelled')"));

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
            entity.Property(x => x.StatusCode)
                .HasColumnName("status_code")
                .HasMaxLength(16)
                .IsRequired();
            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();
            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();
            entity.Property(x => x.ReviewedAt)
                .HasColumnName("reviewed_at");
            entity.Property(x => x.ReviewedByUserId)
                .HasColumnName("reviewed_by_user_id");

            entity.HasIndex(x => new { x.ServerId, x.UserId })
                .IsUnique()
                .HasFilter($"\"status_code\" = '{ServerJoinRequestStatusCodes.Pending}'")
                .HasDatabaseName("UX_ServerJoinRequests_Server_User_Pending");
            entity.HasIndex(x => new
            {
                x.ServerId,
                x.StatusCode,
                x.CreatedAt,
                x.Id
            })
                .HasDatabaseName("IX_ServerJoinRequests_Server_Status_Time");
            entity.HasIndex(x => new { x.UserId, x.StatusCode, x.UpdatedAt })
                .HasDatabaseName("IX_ServerJoinRequests_User_Status_Time");

            entity.HasOne(x => x.Server)
                .WithMany(x => x.JoinRequests)
                .HasForeignKey(x => x.ServerId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ReviewedByUser)
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
