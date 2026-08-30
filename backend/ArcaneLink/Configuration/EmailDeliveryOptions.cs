namespace ArcaneLink.Configuration;

public sealed class EmailDeliveryOptions
{
    public const string SectionName = "EmailDelivery";

    public bool Enabled { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseSslOnConnect { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = "no-reply@arcane-link.ru";
    public string FromName { get; set; } = "ArcaneLink";
    public string PublicOrigin { get; set; } = "https://arcane-link.ru";
    public int EmailVerificationLifetimeHours { get; set; } = 24;
    public int EmailChangeLifetimeHours { get; set; } = 2;
    public int PasswordResetLifetimeMinutes { get; set; } = 30;

    public bool IsValid()
    {
        if (!this.Enabled)
        {
            return true;
        }

        return !string.IsNullOrWhiteSpace(this.Host) &&
               this.Port is > 0 and <= 65535 &&
               !string.IsNullOrWhiteSpace(this.Username) &&
               !string.IsNullOrWhiteSpace(this.Password) &&
               System.Net.Mail.MailAddress.TryCreate(this.FromAddress, out _) &&
               Uri.TryCreate(this.PublicOrigin, UriKind.Absolute, out var origin) &&
               origin.Scheme == Uri.UriSchemeHttps &&
               !string.IsNullOrWhiteSpace(origin.Host) &&
               string.IsNullOrEmpty(origin.UserInfo) &&
               string.IsNullOrEmpty(origin.Query) &&
               string.IsNullOrEmpty(origin.Fragment) &&
               (origin.AbsolutePath.Length == 0 || origin.AbsolutePath == "/") &&
               this.EmailVerificationLifetimeHours is >= 1 and <= 168 &&
               this.EmailChangeLifetimeHours is >= 1 and <= 24 &&
               this.PasswordResetLifetimeMinutes is >= 10 and <= 1440;
    }
}
