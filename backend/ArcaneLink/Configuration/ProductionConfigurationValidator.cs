using Microsoft.Extensions.Hosting;

namespace ArcaneLink.Configuration;

public static class ProductionConfigurationValidator
{
    public const string DevelopmentJwtSecret = "CHANGE_ME_SUPER_SECRET_KEY_MINIMUM_32_CHARS";
    private const string DevelopmentDatabasePassword = "CHANGE_ME";

    public static void Validate(
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        if (environment.IsEnvironment("Testing"))
        {
            return;
        }

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"ConnectionStrings:DefaultConnection must be configured for the {environment.EnvironmentName} environment.");
        }

        if (!environment.IsProduction())
        {
            return;
        }

        var jwtSecret = configuration["JwtSettings:SecretKey"];
        if (string.IsNullOrWhiteSpace(jwtSecret) ||
            jwtSecret == DevelopmentJwtSecret ||
            ContainsPlaceholderMarker(jwtSecret))
        {
            throw new InvalidOperationException(
                "Production JwtSettings:SecretKey must be provided by environment or secret manager.");
        }

        if (connectionString.Contains(DevelopmentDatabasePassword, StringComparison.OrdinalIgnoreCase) ||
            ContainsPlaceholderMarker(connectionString))
        {
            throw new InvalidOperationException(
                "Production database connection string must not use the development password.");
        }

        var allowedHosts = configuration["AllowedHosts"];
        if (string.IsNullOrWhiteSpace(allowedHosts) ||
            string.Equals(allowedHosts.Trim(), "*", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Production AllowedHosts must list explicit host names.");
        }

        var dataProtectionKeysPath = configuration["DataProtection:KeysPath"];
        if (string.IsNullOrWhiteSpace(dataProtectionKeysPath) ||
            !Path.IsPathFullyQualified(dataProtectionKeysPath))
        {
            throw new InvalidOperationException(
                "Production DataProtection:KeysPath must be an absolute persistent path.");
        }

        var turnCredentials = configuration
            .GetSection(TurnCredentialsOptions.SectionName)
            .Get<TurnCredentialsOptions>() ?? new TurnCredentialsOptions();
        if (!turnCredentials.TryValidate(requireEnabled: true, out var turnError))
        {
            throw new InvalidOperationException(
                $"Production requires relay-only TURN credentials. {turnError}");
        }

        ValidateSecurityHeaders(configuration);
        ValidateForwardedHeaders(configuration);
    }

    private static void ValidateSecurityHeaders(IConfiguration configuration)
    {
        var options = configuration
            .GetSection(SecurityHeadersOptions.SectionName)
            .Get<SecurityHeadersOptions>() ?? new SecurityHeadersOptions();

        if (!options.ContentSecurityPolicyEnabled)
        {
            throw new InvalidOperationException(
                "Production SecurityHeaders:ContentSecurityPolicyEnabled must be true.");
        }

        if (string.IsNullOrWhiteSpace(options.ContentSecurityPolicy) ||
            ContainsHeaderNewline(options.ContentSecurityPolicy))
        {
            throw new InvalidOperationException(
                "Production SecurityHeaders:ContentSecurityPolicy must be a valid single-line policy.");
        }

        if (options.ContentSecurityPolicy.Contains(
                "'unsafe-eval'",
                StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Production Content-Security-Policy must not allow 'unsafe-eval'.");
        }

        string[] requiredCspDirectives =
        [
            "script-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'"
        ];
        if (requiredCspDirectives.Any(required =>
                !options.ContentSecurityPolicy.Contains(
                    required,
                    StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException(
                "Production Content-Security-Policy is missing a required restrictive directive.");
        }

        if (string.IsNullOrWhiteSpace(options.PermissionsPolicy) ||
            ContainsHeaderNewline(options.PermissionsPolicy))
        {
            throw new InvalidOperationException(
                "Production SecurityHeaders:PermissionsPolicy must be a valid single-line policy.");
        }

        string[] requiredPermissions =
        [
            "camera=(self)",
            "display-capture=(self)",
            "microphone=(self)",
            "geolocation=()"
        ];
        if (requiredPermissions.Any(required =>
                !options.PermissionsPolicy.Contains(
                    required,
                    StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException(
                "Production Permissions-Policy is missing a required ArcaneLink capability boundary.");
        }
    }

    private static void ValidateForwardedHeaders(IConfiguration configuration)
    {
        var options = configuration
            .GetSection(TrustedForwardedHeadersOptions.SectionName)
            .Get<TrustedForwardedHeadersOptions>() ??
            new TrustedForwardedHeadersOptions();

        if (!TrustedForwardedHeadersOptions.TryValidate(
                options,
                requireTrustedSource: true,
                out var error))
        {
            throw new InvalidOperationException(error);
        }
    }

    private static bool ContainsHeaderNewline(string value)
    {
        return value.Contains('\r') || value.Contains('\n');
    }

    private static bool ContainsPlaceholderMarker(string value)
    {
        return value.Contains("replace-with", StringComparison.OrdinalIgnoreCase) ||
               value.Contains("change-me", StringComparison.OrdinalIgnoreCase);
    }
}
