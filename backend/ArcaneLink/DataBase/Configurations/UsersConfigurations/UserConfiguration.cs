using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    // Конфигурация для сущности User
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        // Настройка модели User
        public void Configure(EntityTypeBuilder<User> entity)
        {
            // Общий алгоритм для описания любой сущности следующий:
            // 1. Указываем имя таблицы для сущности
            // 2. Указываем первичный ключ для сущности
            // 3. Указываем имя столбца для каждого свойства сущности,
            // а также дополнительные настройки,
            // такие как максимальная длина, обязательность и индексы
            // 4. Устанавливаем связи между сущностями, указывая внешние ключи и поведение при удалении
            // 5. Указываем индексы для свойств, которые часто используются в запросах, чтобы ускорить выполнение запросов
            // 6. Указываем дополнительные настройки, такие как тип данных, форматирование и т.д., если это необходимо
            // Этот алгоритм позволяет создать четкую и понятную структуру базы данных.

            // Указываем имя таблицы в базе данных
            entity.ToTable("users");

            // Указываем первичный ключ для сущности User
            entity.HasKey(u => u.Id);

            // Указываем имя столбца для свойства Id
            // ValueGeneratedNever означает, что Guid генерируется в коде приложения, а не базой данных
            entity.Property(u => u.Id)
                .HasColumnName("id")
                .ValueGeneratedNever();

            // Указываем имя столбца для свойства Login, максимальную длину и что оно обязательно
            entity.Property(u => u.Login)
                .HasColumnName("login")
                .HasMaxLength(50)
                .IsRequired();

            // Указываем имя столбца для свойства LoginNorm, максимальную длину и что оно обязательно
            // LoginNorm нужен для уникальности и поиска без зависимости от регистра
            entity.Property(u => u.LoginNorm)
                .HasColumnName("login_norm")
                .HasMaxLength(50)
                .IsRequired();

            // Указываем уникальный индекс для свойства LoginNorm
            // Это запрещает создать двух пользователей с одинаковым логином в нормализованной форме
            entity.HasIndex(u => u.LoginNorm)
                .IsUnique()
                .HasDatabaseName("UX_Users_LoginNorm");

            // Указываем имя столбца для свойства Email, максимальную длину и что оно обязательно
            entity.Property(u => u.Email)
                .HasColumnName("email")
                .HasMaxLength(254)
                .IsRequired();

            // Указываем имя столбца для свойства EmailNorm, максимальную длину и что оно обязательно
            // EmailNorm нужен для уникальности и поиска без зависимости от регистра
            entity.Property(u => u.EmailNorm)
                .HasColumnName("email_norm")
                .HasMaxLength(254)
                .IsRequired();

            // Указываем уникальный индекс для свойства EmailNorm
            // Это запрещает создать двух пользователей с одинаковым email в нормализованной форме
            entity.HasIndex(u => u.EmailNorm)
                .IsUnique()
                .HasDatabaseName("UX_Users_EmailNorm");

            entity.Property(u => u.EmailConfirmedAt)
                .HasColumnName("email_confirmed_at");

            // Указываем имя столбца для свойства PasswordHash, максимальную длину и что оно обязательно
            // Важно: здесь хранится только хеш пароля, а не сырой пароль пользователя
            entity.Property(u => u.PasswordHash)
                .HasColumnName("password_hash")
                .HasMaxLength(512)
                .IsRequired();

            // Указываем имя столбца для свойства StatusId и что оно обязательно
            // StatusId является внешним ключом на таблицу user_statuses
            entity.Property(u => u.StatusId)
                .HasColumnName("status_id")
                .IsRequired();

            // Устанавливаем связь между сущностью User и сущностью UserStatus,
            // указывая внешний ключ и поведение при удалении.
            //
            // HasOne(u => u.Status) означает:
            // у одного пользователя есть один статус.
            //
            // WithMany() означает:
            // один и тот же статус может быть назначен многим пользователям.
            //
            // HasForeignKey(u => u.StatusId) означает:
            // колонка status_id в таблице users является внешним ключом.
            //
            // DeleteBehavior.Restrict означает:
            // нельзя удалить статус из таблицы user_statuses,
            // если на него ссылается хотя бы один пользователь.
            //
            // Это защищает целостность данных:
            // пользователь не может остаться со ссылкой на несуществующий статус.
            entity.HasOne(u => u.Status)
                .WithMany()
                .HasForeignKey(u => u.StatusId)
                .OnDelete(DeleteBehavior.Restrict);

            // Указываем индекс для свойства StatusId, чтобы ускорить запросы по этому полю
            // Например: быстро получить всех active / banned / deleted пользователей
            entity.HasIndex(u => u.StatusId)
                .HasDatabaseName("IX_Users_StatusId");

            entity.Property(u => u.SubscriptionTypeId)
                .HasColumnName("subscription_type_id")
                .HasDefaultValue(SubscriptionTypeIds.Free)
                .IsRequired();

            entity.HasOne(u => u.SubscriptionType)
                .WithMany(x => x.Users)
                .HasForeignKey(u => u.SubscriptionTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(u => u.SubscriptionTypeId)
                .HasDatabaseName("IX_Users_SubscriptionTypeId");

            // Указываем имя столбца для свойства CreatedAt и что оно обязательно
            entity.Property(u => u.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            // Указываем имя столбца для свойства UpdatedAt
            entity.Property(u => u.UpdatedAt)
                .HasColumnName("updated_at");

            // Указываем имя столбца для свойства DeletedAt
            // Используется для soft delete: пользователь считается удалённым, но запись остаётся в базе
            entity.Property(u => u.DeletedAt)
                .HasColumnName("deleted_at");

            // Указываем имя столбца для свойства PasswordChangedAt
            // Можно использовать для инвалидирования старых сессий/токенов после смены пароля
            entity.Property(u => u.PasswordChangedAt)
                .HasColumnName("password_changed_at");

            // Указываем имя столбца для свойства LastSeenAt
            // Хранит дату последней активности пользователя
            entity.Property(u => u.LastSeenAt)
                .HasColumnName("last_seen_at");

        }
    }
}
