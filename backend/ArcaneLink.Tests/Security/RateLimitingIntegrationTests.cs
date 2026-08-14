using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ArcaneLink.Extensions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace ArcaneLink.Tests.Security;

public sealed class RateLimitingIntegrationTests
{
    [Fact]
    public async Task AuthLimit_ReturnsRetryableProblemDetails()
    {
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["RateLimiting:Auth:PermitLimit"] = "1",
                    ["RateLimiting:Auth:WindowSeconds"] = "60"
                });
            });
        });
        using var client = factory.CreateClient();

        using var firstResponse = await client.SendAsync(CreateInvalidLoginRequest());
        Assert.Equal(HttpStatusCode.BadRequest, firstResponse.StatusCode);

        using var rejectedResponse = await client.SendAsync(CreateInvalidLoginRequest());

        Assert.Equal(HttpStatusCode.TooManyRequests, rejectedResponse.StatusCode);
        Assert.Equal(
            "application/problem+json",
            rejectedResponse.Content.Headers.ContentType?.MediaType);

        var retryAfter = Assert.Single(
            rejectedResponse.Headers.GetValues("Retry-After"));
        Assert.True(int.TryParse(retryAfter, out var retryAfterSeconds));
        Assert.True(retryAfterSeconds > 0);

        var problem = await rejectedResponse.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(problem);
        Assert.Equal(429, problem["status"]?.GetValue<int>());
        Assert.Equal("Too many requests.", problem["title"]?.GetValue<string>());
        Assert.Equal("auth", problem["policy"]?.GetValue<string>());
        Assert.Equal(
            retryAfterSeconds,
            problem["retryAfterSeconds"]?.GetValue<int>());
        Assert.False(string.IsNullOrWhiteSpace(problem["traceId"]?.GetValue<string>()));

    }

    [Fact]
    public void UnauthenticatedPartition_NormalizesMappedIpv4AndSeparatesAddresses()
    {
        var mappedContext = CreateContext("::ffff:198.51.100.10");
        var ipv4Context = CreateContext("198.51.100.10");
        var differentContext = CreateContext("198.51.100.11");

        var mappedKey = RateLimitingExtensions.GetRateLimitPartitionKey(mappedContext);
        var ipv4Key = RateLimitingExtensions.GetRateLimitPartitionKey(ipv4Context);
        var differentKey = RateLimitingExtensions.GetRateLimitPartitionKey(differentContext);

        Assert.Equal("ip:198.51.100.10", mappedKey);
        Assert.Equal(mappedKey, ipv4Key);
        Assert.NotEqual(mappedKey, differentKey);
    }

    [Fact]
    public async Task HealthEndpoint_IsNotRateLimited()
    {
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["RateLimiting:Auth:PermitLimit"] = "1",
                    ["RateLimiting:Uploads:PermitLimit"] = "1",
                    ["RateLimiting:Invites:PermitLimit"] = "1",
                    ["RateLimiting:DiscoverySearch:PermitLimit"] = "1",
                    ["RateLimiting:SignalRConnect:PermitLimit"] = "1"
                });
            });
        });
        using var client = factory.CreateClient();

        for (var attempt = 0; attempt < 3; attempt++)
        {
            using var response = await client.GetAsync("/health/live");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    private static HttpRequestMessage CreateInvalidLoginRequest()
    {
        return new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { })
        };
    }

    private static DefaultHttpContext CreateContext(string remoteIpAddress)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse(remoteIpAddress);
        return context;
    }
}
