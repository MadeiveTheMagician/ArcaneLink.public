using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using ArcaneLink.DataBase.DTOs.Voice;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Voice;

public sealed class VoiceIceServersIntegrationTests
{
    private const string SharedSecret =
        "integration-shared-secret-with-at-least-32-characters";
    private static readonly DateTimeOffset Now =
        new(2026, 8, 11, 18, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task Endpoint_RequiresAuthentication()
    {
        using var factory = CreateConfiguredFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/voice/ice-servers");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Endpoint_ReturnsShortLivedRelayOnlyCredentialsWithoutCaching()
    {
        using var factory = CreateConfiguredFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.GetAsync("/api/voice/ice-servers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Contains("no-cache", response.Headers.Pragma.ToString());

        var payload = await response.Content
            .ReadFromJsonAsync<VoiceIceServerResponse>();
        Assert.NotNull(payload);
        Assert.Equal("relay", payload.IceTransportPolicy);
        Assert.Equal(Now.AddMinutes(10), payload.ExpiresAt);

        var iceServer = Assert.Single(payload.IceServers);
        var expectedUsername =
            $"{payload.ExpiresAt.ToUnixTimeSeconds()}:{ArcaneLinkApiFactory.OwnerUserId:N}";
        Assert.Equal(expectedUsername, iceServer.Username);
        Assert.Equal("password", iceServer.CredentialType);
        Assert.All(
            iceServer.Urls,
            url => Assert.StartsWith("turn:", url, StringComparison.Ordinal));

        var expectedCredential = Convert.ToBase64String(
            HMACSHA1.HashData(
                Encoding.UTF8.GetBytes(SharedSecret),
                Encoding.UTF8.GetBytes(expectedUsername)));
        Assert.Equal(expectedCredential, iceServer.Credential);

        var rawBody = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(SharedSecret, rawBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Endpoint_WhenTurnIsDisabled_ReturnsExplicitUnavailableProblem()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var response = await client.GetAsync("/api/voice/ice-servers");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var problem = await response.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(
            "turn_credentials_unavailable",
            problem?["code"]?.GetValue<string>());
    }

    [Fact]
    public async Task Endpoint_IsRateLimitedPerAuthenticatedUser()
    {
        using var factory = CreateConfiguredFactory(permitLimit: 1);
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var first = await client.GetAsync("/api/voice/ice-servers");
        using var second = await client.GetAsync("/api/voice/ice-servers");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateConfiguredFactory(
        int permitLimit = 12)
    {
        var baseFactory = new ArcaneLinkApiFactory();
        return baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["TurnCredentials:Enabled"] = "true",
                        ["TurnCredentials:SharedSecret"] = SharedSecret,
                        ["TurnCredentials:TtlSeconds"] = "600",
                        ["TurnCredentials:Urls:0"] =
                            "turn:relay.example.test:3478?transport=udp",
                        ["TurnCredentials:Urls:1"] =
                            "turn:relay.example.test:3478?transport=tcp",
                        ["RateLimiting:TurnCredentials:PermitLimit"] =
                            permitLimit.ToString(),
                        ["RateLimiting:TurnCredentials:WindowSeconds"] = "60"
                    });
            });
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(
                    new ManualTimeProvider(Now));
            });
        });
    }
}
