using System.Security.Cryptography;
using System.Text;
using ArcaneLink.Configuration;
using ArcaneLink.Services.Voice;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Tests.Voice;

public sealed class TurnCredentialServiceTests
{
    private static readonly DateTimeOffset Now =
        new(2026, 8, 11, 18, 30, 0, TimeSpan.Zero);

    [Fact]
    public void IssueForUser_CreatesCoturnRestCredentialWithExpectedExpiry()
    {
        const string secret = "test-shared-secret-with-at-least-32-characters";
        var userId = Guid.Parse("e5908e84-d17a-499d-ae9f-2f5c781eea2b");
        var service = new TurnCredentialService(
            Options.Create(new TurnCredentialsOptions
            {
                Enabled = true,
                SharedSecret = secret,
                TtlSeconds = 600,
                Urls =
                [
                    "turn:relay.example.test:3478?transport=udp",
                    "turn:relay.example.test:3478?transport=udp",
                    "turns:relay.example.test:5349?transport=tcp"
                ]
            }),
            new ManualTimeProvider(Now));

        var response = service.IssueForUser(userId);

        var expiresAt = Now.AddMinutes(10);
        var expectedUsername =
            $"{expiresAt.ToUnixTimeSeconds()}:{userId:N}";
        var expectedCredential = Convert.ToBase64String(
            HMACSHA1.HashData(
                Encoding.UTF8.GetBytes(secret),
                Encoding.UTF8.GetBytes(expectedUsername)));

        Assert.Equal(expiresAt, response.ExpiresAt);
        Assert.Equal("relay", response.IceTransportPolicy);
        var iceServer = Assert.Single(response.IceServers);
        Assert.Equal(expectedUsername, iceServer.Username);
        Assert.Equal(expectedCredential, iceServer.Credential);
        Assert.Equal("password", iceServer.CredentialType);
        Assert.Equal(2, iceServer.Urls.Count);
        Assert.All(
            iceServer.Urls,
            url => Assert.True(
                url.StartsWith("turn:", StringComparison.Ordinal) ||
                url.StartsWith("turns:", StringComparison.Ordinal)));
        Assert.DoesNotContain(secret, iceServer.Credential, StringComparison.Ordinal);
    }

    [Fact]
    public void IssueForUser_WhenDisabled_FailsClosed()
    {
        var service = new TurnCredentialService(
            Options.Create(new TurnCredentialsOptions()),
            new ManualTimeProvider(Now));

        Assert.False(service.IsAvailable);
        Assert.Throws<InvalidOperationException>(
            () => service.IssueForUser(Guid.NewGuid()));
    }
}
