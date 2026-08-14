namespace ArcaneLink.DataBase.DTOs.Auth
{
    public class RefreshTokenRequest
    {
        // DTO запроса на обновление токенов.
        //
        // Клиент отправляет refresh token,
        // чтобы получить новую пару токенов.
        public string? RefreshToken { get; set; }
    }
}
