using ArcaneLink.DataBase.Models.AuthModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.AuthConfigurations
{
    // Конфигурация пользовательских device sessions.
    //
    // Device session — это конкретное устройство/браузер.
    //
    // Важно:
    // одна device session может пережить много refresh token rotation.
    //
    // Связь:
    // User (1) -> (M) DeviceSessions
    public class UserDeviceSessionConfiguration
        : IEntityTypeConfiguration<UserDeviceSession>
    {
        public void Configure(EntityTypeBuilder<UserDeviceSession> entity)
        {
            entity.ToTable("user_device_sessions");

            // PK
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            // FK -> users
            entity.Property(x => x.UserId)
                .HasColumnName("user_id")
                .IsRequired();

            // Дата создания device session
            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            // Последняя активность
            entity.Property(x => x.LastUsedAt)
                .HasColumnName("last_used_at")
                .IsRequired();

            // Если сессия отозвана
            entity.Property(x => x.RevokedAt)
                .HasColumnName("revoked_at");

            // IP адрес
            entity.Property(s => s.IpAddress)
                .HasColumnName("ip_address")
                .HasMaxLength(64);

            // User-Agent клиента
            entity.Property(x => x.UserAgent)
                .HasColumnName("user_agent")
                .HasMaxLength(512);

            // Человеко-читаемое имя устройства
            entity.Property(x => x.DeviceName)
                .HasColumnName("device_name")
                .HasMaxLength(128);

            // Индекс по активности устройства
            entity.HasIndex(x => new { x.UserId, x.LastUsedAt })
                .HasDatabaseName("IX_UserDeviceSessions_User_LastUsed");

            // Индекс по revoke состоянию
            entity.HasIndex(x => new { x.UserId, x.RevokedAt })
                .HasDatabaseName("IX_UserDeviceSessions_User_Revoked");

            // User -> DeviceSessions
            entity.HasOne(x => x.User)
                .WithMany(u => u.DeviceSessions)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
