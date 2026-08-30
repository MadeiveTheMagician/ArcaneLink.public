using ArcaneLink.Middleware;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace ArcaneLink.Tests.Security;

public sealed class SecurityHeadersIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly ArcaneLinkApiFactory _factory;

    public SecurityHeadersIntegrationTests(ArcaneLinkApiFactory factory)
    {
        this._factory = factory;
    }

    [Theory]
    [InlineData("/ping")]
    [InlineData("/route-that-does-not-exist")]
    public async Task Responses_IncludeBaselineAndReportOnlyPolicies(string path)
    {
        using var client = this._factory.CreateClient();

        using var response = await client.GetAsync(path);

        AssertHeader(response, "X-Content-Type-Options", "nosniff");
        AssertHeader(
            response,
            "Referrer-Policy",
            "strict-origin-when-cross-origin");
        AssertHeader(response, "X-Frame-Options", "DENY");

        var permissionsPolicy = GetHeader(response, "Permissions-Policy");
        Assert.Contains("camera=(self)", permissionsPolicy, StringComparison.Ordinal);
        Assert.Contains("microphone=(self)", permissionsPolicy, StringComparison.Ordinal);
        Assert.Contains("display-capture=(self)", permissionsPolicy, StringComparison.Ordinal);
        Assert.Contains("geolocation=()", permissionsPolicy, StringComparison.Ordinal);

        var csp = GetHeader(
            response,
            SecurityHeadersMiddleware.ContentSecurityPolicyReportOnlyHeader);
        Assert.False(
            response.Headers.Contains(
                SecurityHeadersMiddleware.ContentSecurityPolicyHeader));
        Assert.Contains("script-src 'self'", csp, StringComparison.Ordinal);
        Assert.Contains("style-src 'self' 'unsafe-inline'", csp, StringComparison.Ordinal);
        Assert.Contains("media-src 'self' blob: https:", csp, StringComparison.Ordinal);
        Assert.Contains("worker-src 'self' blob:", csp, StringComparison.Ordinal);
        Assert.Contains("connect-src 'self' https: wss:", csp, StringComparison.Ordinal);
        Assert.Contains("https://www.youtube-nocookie.com", csp, StringComparison.Ordinal);
        Assert.Contains("https://player.twitch.tv", csp, StringComparison.Ordinal);
        Assert.Contains("object-src 'none'", csp, StringComparison.Ordinal);
        Assert.Contains("base-uri 'self'", csp, StringComparison.Ordinal);
        Assert.Contains("frame-ancestors 'none'", csp, StringComparison.Ordinal);
        Assert.DoesNotContain("'unsafe-eval'", csp, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task EnforcedMode_ReplacesReportOnlyHeader()
    {
        using var enforcedFactory = this._factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["SecurityHeaders:ContentSecurityPolicyReportOnly"] = "false"
                    });
            });
        });
        using var client = enforcedFactory.CreateClient();

        using var response = await client.GetAsync("/ping");

        Assert.True(
            response.Headers.Contains(
                SecurityHeadersMiddleware.ContentSecurityPolicyHeader));
        Assert.False(
            response.Headers.Contains(
                SecurityHeadersMiddleware.ContentSecurityPolicyReportOnlyHeader));
    }

    private static void AssertHeader(
        HttpResponseMessage response,
        string name,
        string expected)
    {
        Assert.Equal(expected, GetHeader(response, name));
    }

    private static string GetHeader(HttpResponseMessage response, string name)
    {
        Assert.True(response.Headers.TryGetValues(name, out var values));
        return string.Join(", ", values);
    }
}
