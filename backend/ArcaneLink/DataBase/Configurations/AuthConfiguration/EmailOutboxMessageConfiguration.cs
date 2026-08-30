using ArcaneLink.DataBase.Models.AuthModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.AuthConfigurations;

public sealed class EmailOutboxMessageConfiguration
    : IEntityTypeConfiguration<EmailOutboxMessage>
{
    public void Configure(EntityTypeBuilder<EmailOutboxMessage> entity)
    {
        entity.ToTable("email_outbox_messages");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(32).IsRequired();
        entity.Property(x => x.ProtectedPayload).HasColumnName("protected_payload").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.Property(x => x.AvailableAt).HasColumnName("available_at").IsRequired();
        entity.Property(x => x.AttemptCount).HasColumnName("attempt_count").IsRequired();
        // Fence stale workers: every tracked acknowledgement/update must still
        // own the same lease that was used when the message was claimed.
        entity.Property(x => x.LeaseId)
            .IsConcurrencyToken()
            .HasColumnName("lease_id");
        entity.Property(x => x.LeaseExpiresAt).HasColumnName("lease_expires_at");
        entity.Property(x => x.ProcessedAt).HasColumnName("processed_at");
        entity.Property(x => x.DeadLetteredAt).HasColumnName("dead_lettered_at");
        entity.Property(x => x.LastError).HasColumnName("last_error").HasMaxLength(512);
        entity.HasIndex(x => new
        {
            x.ProcessedAt,
            x.DeadLetteredAt,
            x.AvailableAt,
            x.LeaseExpiresAt
        })
            .HasDatabaseName("IX_EmailOutboxMessages_Dispatch");
    }
}
