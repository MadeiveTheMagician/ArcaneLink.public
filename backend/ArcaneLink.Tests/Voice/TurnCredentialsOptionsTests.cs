using ArcaneLink.Configuration;

namespace ArcaneLink.Tests.Voice;

public sealed class TurnCredentialsOptionsTests
{
    private const string ValidSecret =
        "test-shared-secret-with-at-least-32-characters";

    [Fact]
    public void DisabledConfiguration_DoesNotRequireSecretOrUrls()
    {
        var options = new TurnCredentialsOptions();

        Assert.True(options.HasValidConfiguration());
    }

    [Theory]
    [InlineData(59)]
    [InlineData(3601)]
    public void EnabledConfiguration_RejectsTtlOutsideSafeRange(int ttlSeconds)
    {
        var options = CreateValidOptions();
        options.TtlSeconds = ttlSeconds;

        Assert.False(options.HasValidConfiguration());
    }

    [Theory]
    [InlineData("stun:relay.example.test:3478")]
    [InlineData("https://relay.example.test")]
    [InlineData("turn:")]
    [InlineData("turn:relay.example.test:3478 bad")]
    public void EnabledConfiguration_RejectsNonTurnOrMalformedUrls(string url)
    {
        var options = CreateValidOptions();
        options.Urls = [url];

        Assert.False(options.HasValidConfiguration());
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("replace-with-a-long-random-secret-value")]
    [InlineData("change-me-to-a-long-random-secret-value")]
    public void EnabledConfiguration_RejectsMissingWeakOrPlaceholderSecret(
        string secret)
    {
        var options = CreateValidOptions();
        options.SharedSecret = secret;

        Assert.False(options.HasValidConfiguration());
    }

    private static TurnCredentialsOptions CreateValidOptions()
    {
        return new TurnCredentialsOptions
        {
            Enabled = true,
            SharedSecret = ValidSecret,
            TtlSeconds = 600,
            Urls = ["turn:relay.example.test:3478?transport=udp"]
        };
    }
}
