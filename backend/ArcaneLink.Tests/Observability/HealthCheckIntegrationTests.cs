using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Observability;

public sealed class HealthCheckIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly HttpClient _client;

    public HealthCheckIntegrationTests(ArcaneLinkApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task LiveHealth_ReturnsHealthyJson()
    {
        var response = await _client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadFromJsonAsync<JsonObject>();

        Assert.Equal("Healthy", body?["status"]?.GetValue<string>());
        Assert.Equal("Healthy", body?["checks"]?["self"]?["status"]?.GetValue<string>());
    }

    [Fact]
    public async Task ReadyHealth_ReturnsJsonWithDependencyChecks()
    {
        var response = await _client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadFromJsonAsync<JsonObject>();
        var checks = body?["checks"]?.AsObject();

        Assert.Equal("Unhealthy", body?["status"]?.GetValue<string>());
        AssertHealthCheck(checks, "database", "Healthy");
        AssertHealthCheck(checks, "storage", "Healthy");
        AssertHealthCheck(checks, "jwt", "Healthy");
        AssertHealthCheck(checks, "data_protection", "Healthy");
        AssertHealthCheck(checks, "migrations", "Unhealthy");
        AssertHealthCheck(checks, "signalr", "Healthy");
    }

    private static void AssertHealthCheck(JsonObject? checks, string name, string expectedStatus)
    {
        Assert.NotNull(checks);
        Assert.True(checks.ContainsKey(name), $"Expected health check '{name}' to be present.");
        Assert.Equal(expectedStatus, checks[name]?["status"]?.GetValue<string>());
    }
}
