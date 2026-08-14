using ArcaneLink.DataBase.Models.AuthModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.AuthConfigurations
{
    // Конфигурация refresh токенов пользователя.
    //
    // Refresh token:
    // - используется для перевыпуска access token;
    // - хранится в БД только в виде hash;
    // - может быть привязан к device session;
    // - поддерживает token rotation.
    public class UserRefreshTokenConfiguration
        : IEntityTypeConfiguration<UserRefreshToken>
    {
        public void Configure(EntityTypeBuilder<UserRefreshToken> entity)
        {
            // Имя таблицы
            entity.ToTable("user_refresh_tokens");

            // Primary Key
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            // FK -> Users
            entity.Property(x => x.UserId)
                .HasColumnName("user_id")
                .IsRequired();

            // Хеш refresh token.
            //
            // Raw token в базе НЕ хранится.
            entity.Property(x => x.TokenHash)
                .HasColumnName("token_hash")
                .IsRequired()
                .HasMaxLength(64)
                .IsFixedLength();   

            // Когда токен был создан
            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            // Когда токен истекает
            entity.Property(x => x.ExpiresAt)
                .HasColumnName("expires_at")
                .IsRequired();

            // Когда токен был отозван
            entity.Property(x => x.RevokedAt)
                .HasColumnName("revoked_at");

            // Ссылка на новый токен после rotation
            entity.Property(x => x.ReplacedByTokenId)
                .HasColumnName("replaced_by_token_id");

            // IP адрес создания токена
            entity.Property(x => x.CreatedByIp)
                .HasColumnName("created_by_ip")
                .HasMaxLength(64);

            // IP адрес revoke токена
            entity.Property(x => x.RevokedByIp)
                .HasColumnName("revoked_by_ip")
                .HasMaxLength(64);

            // User-Agent клиента
            entity.Property(x => x.UserAgent)
                .HasColumnName("user_agent")
                .HasMaxLength(512);

            // FK -> Device Session
            entity.Property(x => x.DeviceSessionId)
                .HasColumnName("device_session_id");

            // Индекс для быстрого поиска токенов устройства
            entity.HasIndex(x => x.DeviceSessionId)
                .HasDatabaseName("IX_UserRefreshTokens_DeviceSessionId");

            // DeviceSession -> RefreshTokens
            //
            // Если device session удалена —
            // токен остаётся в истории.
            entity.HasOne(x => x.DeviceSession)
                .WithMany(x => x.RefreshTokens)
                .HasForeignKey(x => x.DeviceSessionId)
                .OnDelete(DeleteBehavior.SetNull);

            // Индекс по пользователю и времени создания
            entity.HasIndex(x => new { x.UserId, x.CreatedAt })
                .HasDatabaseName("IX_UserRefreshTokens_User_Time");

            // TokenHash уникален
            entity.HasIndex(x => x.TokenHash)
                .IsUnique()
                .HasDatabaseName("UX_UserRefreshTokens_TokenHash");

            // Индекс по expiration
            entity.HasIndex(x => x.ExpiresAt)
                .HasDatabaseName("IX_UserRefreshTokens_ExpiresAt");

            // Индекс для token rotation chain
            entity.HasIndex(x => x.ReplacedByTokenId)
                .HasDatabaseName("IX_UserRefreshTokens_ReplacedBy");

            // User -> RefreshTokens
            entity.HasOne(x => x.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Self-reference:
            // старый refresh token -> новый refresh token
            entity.HasOne(x => x.ReplacedByToken)
                .WithMany()
                .HasForeignKey(x => x.ReplacedByTokenId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}