using ArcaneLink.DataBase.Models.AuthModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.AuthConfigurations;

public sealed class UserAccountActionTokenConfiguration
    : IEntityTypeConfiguration<UserAccountActionToken>
{
    public void Configure(EntityTypeBuilder<UserAccountActionToken> entity)
    {
        entity.ToTable("user_account_action_tokens");
        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.Purpose).HasColumnName("purpose").HasMaxLength(32).IsRequired();
        entity.Property(x => x.TokenHash).HasColumnName("token_hash").HasMaxLength(64).IsFixedLength().IsRequired();
        entity.Property(x => x.PendingValue).HasColumnName("pending_value").HasMaxLength(254);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at").IsRequired();
        entity.Property(x => x.ConsumedAt)
            .HasColumnName("consumed_at")
            .IsConcurrencyToken();

        entity.HasIndex(x => x.TokenHash)
            .IsUnique()
            .HasDatabaseName("UX_UserAccountActionTokens_TokenHash");
        entity.HasIndex(x => new { x.UserId, x.Purpose, x.ConsumedAt })
            .HasDatabaseName("IX_UserAccountActionTokens_User_Purpose_Consumed");
        entity.HasIndex(x => new { x.UserId, x.Purpose })
            .IsUnique()
            .HasFilter("consumed_at IS NULL")
            .HasDatabaseName("UX_UserAccountActionTokens_User_Purpose_Active");
        entity.HasIndex(x => x.ExpiresAt)
            .HasDatabaseName("IX_UserAccountActionTokens_ExpiresAt");

        entity.HasOne(x => x.User)
            .WithMany(x => x.AccountActionTokens)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
