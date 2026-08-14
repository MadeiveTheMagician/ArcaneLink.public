namespace ArcaneLink.Services.JwtService
{
    public class JwtSettings
    {
        public string Issuer { get; set; } = null!;
        public string Audience { get; set; } = null!;
        public string SecretKey { get; set; } = null!;
        public int AccessTokenExpirationMinutes { get; set; }
        public int RefreshTokenExpirationDays { get; set; }
        public int DeviceSessionIdleExpirationDays { get; set; } = 180;
        public int DeviceSessionAbsoluteExpirationDays { get; set; } = 365;
    }
}
