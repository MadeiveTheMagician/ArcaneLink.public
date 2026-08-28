using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.JwtService.Abstariction;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

// Сервис для генерации JWT Access и Refresh токенов

namespace ArcaneLink.Services.JwtService;

public class JwtService : IJwtTokenService
{
    // Конфигурация JWT, загружаемая из appsettings.json
    private readonly JwtSettings _jwtSettings;
    // Конструктор, принимающий IOptions для загрузки настроек JWT
    public JwtService(IOptions<JwtSettings> jwtOptions)
    {
        this._jwtSettings = jwtOptions.Value;
    }

    // Метод для генерации JWT Access токена на основе данных пользователя
    public string GenerateAccessToken(User user, Guid deviceSessionId)
    {
        // Создаем список претензий (claims) для токена, включая идентификатор пользователя, логин и email
        // Эти претензии будут включены в payload JWT и могут быть использованы для аутентификации и авторизации
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Login),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("userId", user.Id.ToString()),
            new("deviceSessionId", deviceSessionId.ToString())
        };

        // Создаем симметричный ключ для подписи токена, используя секретный ключ из настроек JWT
        // Секретный ключ должен быть достаточно длинным и сложным для обеспечения безопасности токена
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(this._jwtSettings.SecretKey));
        // Создаем учетные данные для подписи токена, используя алгоритм HMAC SHA256
        var credentials = new SigningCredentials(
            key,
            SecurityAlgorithms.HmacSha256);
        // Создаем JWT токен, указывая издателя, аудиторию, претензии, время истечения и учетные данные для подписи
        var token = new JwtSecurityToken(
            issuer: this._jwtSettings.Issuer,
            audience: this._jwtSettings.Audience,
            claims: claims,
            expires: this.GetAccessTokenExpirationUtc(),
            signingCredentials: credentials);
        // Сериализуем JWT токен в строку и возвращаем его
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
    // Метод для получения времени истечения JWT Access токена в формате UTC
    public DateTime GetAccessTokenExpirationUtc()
    {
        return DateTime.UtcNow.AddMinutes(
            this._jwtSettings.AccessTokenExpirationMinutes);
    }
    // Метод для генерации случайного Refresh токена, который будет использоваться для получения нового Access токена
    public string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
    // Метод для хэширования Refresh токена с помощью SHA256, чтобы безопасно хранить его в базе данных
    public string HashRefreshToken(string refreshToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToHexString(bytes);
    }
    // Метод для получения времени истечения Refresh токена в формате UTC
    public DateTime GetRefreshTokenExpirationUtc()
    {
        return DateTime.UtcNow.AddDays(
            this._jwtSettings.RefreshTokenExpirationDays);
    }

}
