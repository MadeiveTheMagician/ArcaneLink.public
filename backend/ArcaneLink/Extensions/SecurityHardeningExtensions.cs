using ArcaneLink.Configuration;
using Microsoft.AspNetCore.HttpOverrides;

namespace ArcaneLink.Extensions;

public static class SecurityHardeningExtensions
{
    public static IServiceCollection AddArcaneLinkSecurityHardening(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<SecurityHeadersOptions>(
            configuration.GetSection(SecurityHeadersOptions.SectionName));

        var trustedProxyOptions =
            configuration
                .GetSection(TrustedForwardedHeadersOptions.SectionName)
                .Get<TrustedForwardedHeadersOptions>() ??
            new TrustedForwardedHeadersOptions();

        services.Configure<ForwardedHeadersOptions>(
            trustedProxyOptions.ApplyTo);

        return services;
    }
}
