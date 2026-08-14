using ArcaneLink.DataBase.DTOs.Users;

namespace ArcaneLink.Services.Users.Abstractions
{
    // Интерфейс сервиса регистрации пользователей

    public interface IUserRegistrationService
    {
        // Метод регистрации пользователя
        Task<UserResponse> RegisterAsync(
            CreateUserRequest request,
            CancellationToken cancellationToken = default);
    }
}