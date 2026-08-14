namespace ArcaneLink.DataBase.DTOs.Auth
{
    public class RefreshTokenResponse
    {
        // DTO ответа на обновление токенов.
        //
        // Возвращает новую пару:
        // - access token
        // - refresh token
        public string AccessToken { get; set; } = null!;
        public DateTime AccessTokenExpireAt { get; set; }

        public string RefreshToken { get; set; } = null!;
        public DateTime RefreshTokenExpireAt { get; set; }
    }
}
