namespace ArcaneLink.DataBase.DTOs.Login
{
    // DTO ответа после успешного входа.
    //
    // Сейчас проверяем сам login pipeline:
    // - нашли пользователя
    // - проверили пароль
    // - вернули безопасные данные
    public class LoginResponse
    {
        public Guid Id { get; set; }

        public string Login { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public ArcaneLink.DataBase.DTOs.Users.SubscriptionTypeResponse SubscriptionType { get; set; } = null!;

        public DateTime LoggedInAt { get; set; }
        public string AccessToken { get; set; } = null!;
        public DateTime AccessTokenExpireAt { get; set; }   
        public string RefreshToken { get; set; } = null!;
        public DateTime RefreshTokenExpireAt { get; set; }

        public Guid? DeviceSessionId { get; set; }
    }
}
