namespace ArcaneLink.DataBase.DTOs.Auth;

public class AuthTokenPair
{
    public string AccessToken { get; set; } = null!;
    public DateTime AccessTokenExpiresAt { get; set; }

    public string RefreshToken { get; set; } = null!;
    public DateTime RefreshTokenExpiresAt { get; set; }

    public Guid? DeviceSessionId { get; set; }
}
