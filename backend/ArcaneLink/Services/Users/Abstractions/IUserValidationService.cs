namespace ArcaneLink.Services.Users.Abstractions
{
    // Интерфейс сервиса валидации пользователя.
    //
    // Контроллеры и другие сервисы зависят от интерфейса,
    // а не от конкретной реализации.
    public interface IUserValidationService
    {
        // Проверяет возможность регистрации пользователя.
        //
        // Если всё хорошо — метод завершается без результата.
        // Если есть ошибка — выбрасывается кастомное исключение.
        Task ValidateRegistrationAsync(
            string login,
            string email,
            CancellationToken cancellationToken = default);
    }
}