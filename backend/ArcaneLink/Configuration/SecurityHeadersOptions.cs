namespace ArcaneLink.Configuration;

public sealed class SecurityHeadersOptions
{
    public const string SectionName = "SecurityHeaders";

    public const string DefaultContentSecurityPolicy =
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https:; " +
        "font-src 'self' data: https:; " +
        "media-src 'self' blob: https:; " +
        "connect-src 'self' https: wss:; " +
        "worker-src 'self' blob:; " +
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com " +
        "https://player.twitch.tv https://clips.twitch.tv; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'";

    public const string DefaultPermissionsPolicy =
        "accelerometer=(), ambient-light-sensor=(), " +
        "autoplay=(self \"https://www.youtube.com\" \"https://www.youtube-nocookie.com\" " +
        "\"https://player.twitch.tv\" \"https://clips.twitch.tv\"), " +
        "camera=(self), display-capture=(self), " +
        "encrypted-media=(self \"https://www.youtube.com\" \"https://www.youtube-nocookie.com\"), " +
        "fullscreen=(self \"https://www.youtube.com\" \"https://www.youtube-nocookie.com\" " +
        "\"https://player.twitch.tv\" \"https://clips.twitch.tv\"), " +
        "geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), " +
        "payment=(), picture-in-picture=(self \"https://www.youtube.com\" " +
        "\"https://www.youtube-nocookie.com\"), usb=()";

    public bool ContentSecurityPolicyEnabled { get; set; } = true;

    public bool ContentSecurityPolicyReportOnly { get; set; } = true;

    public string ContentSecurityPolicy { get; set; } =
        DefaultContentSecurityPolicy;

    public string PermissionsPolicy { get; set; } = DefaultPermissionsPolicy;
}
