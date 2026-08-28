using ArcaneLink.DataBase._Data;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Users
{
    // Сервис валидации пользователя.
    //
    // Отвечает за проверки, связанные с бизнес-правилами пользователя.
    //
    // Сейчас проверяет:
    // 1. Свободен ли логин
    // 2. Свободен ли email
    //
    // Важно:
    // этот сервис НЕ создаёт пользователя,
    // НЕ хеширует пароль,
    // НЕ сохраняет данные.
    // Он только проверяет бизнес-ограничения.
    public class UserValidationService : IUserValidationService
    {
        // Контекст базы данных.
        // Нужен для проверки существующих пользователей.
        private readonly AppDbContext _db;

        // Внедрение AppDbContext через DI.
        public UserValidationService(AppDbContext db)
        {
            this._db = db;
        }

        // Валидация данных регистрации.
        //
        // Если данные валидны — метод просто завершается.
        //
        // Если логин занят — выбрасывает LoginAlreadyExistsException.
        // Если email занят — выбрасывает EmailAlreadyExistsException.
        public async Task ValidateRegistrationAsync(
            string login,
            string email,
            CancellationToken cancellationToken = default)
        {
            // Нормализуем логин так же, как при сохранении пользователя.
            // Это нужно, чтобы ExampleUser и exampleuser считались одинаковым логином.
            var loginNorm = login.Trim().ToUpperInvariant();

            // Нормализуем email так же, как при сохранении пользователя.
            var emailNorm = email.Trim().ToUpperInvariant();

            // Проверяем, существует ли пользователь с таким нормализованным логином.
            var loginExists = await this._db.Users
                .AnyAsync(u => u.LoginNorm == loginNorm, cancellationToken);

            // Если логин уже есть — выбрасываем предметное исключение.
            if (loginExists)
            {
                throw new LoginAlreadyExistsException();
            }

            // Проверяем, существует ли пользователь с таким нормализованным email.
            var emailExists = await this._db.Users
                .AnyAsync(u => u.EmailNorm == emailNorm, cancellationToken);

            // Если email уже есть — выбрасываем предметное исключение.
            if (emailExists)
            {
                throw new EmailAlreadyExistsException();
            }
        }
    }
}
