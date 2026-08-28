using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.Services.JwtService.Abstariction
{
    public interface IJwtTokenService
    {
        public string GenerateAccessToken(User user, Guid deviceSessionId);
        public DateTime GetAccessTokenExpirationUtc();

        public string GenerateRefreshToken();
        public string HashRefreshToken(string refreshToken);
        DateTime GetRefreshTokenExpirationUtc();
    }
}
