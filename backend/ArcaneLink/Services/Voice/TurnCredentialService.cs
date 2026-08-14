using System.Security.Cryptography;
using System.Text;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Voice;
using ArcaneLink.Services.Voice.Abstractions;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Voice;

public sealed class TurnCredentialService : ITurnCredentialService
{
    private readonly TurnCredentialsOptions _options;
    private readonly TimeProvider _timeProvider;

    public TurnCredentialService(
        IOptions<TurnCredentialsOptions> options,
        TimeProvider timeProvider)
    {
        _options = options.Value;
        _timeProvider = timeProvider;
    }

    public bool IsAvailable => _options.Enabled;

    public VoiceIceServerResponse IssueForUser(Guid userId)
    {
        if (!IsAvailable)
        {
            throw new InvalidOperationException("TURN credentials are not enabled.");
        }

        var expiresAt = _timeProvider
            .GetUtcNow()
            .AddSeconds(_options.TtlSeconds);
        var username = $"{expiresAt.ToUnixTimeSeconds()}:{userId:N}";
        var credential = CreateCredential(_options.SharedSecret, username);

        return new VoiceIceServerResponse
        {
            IceServers =
            [
                new VoiceIceServer
                {
                    Urls = _options.Urls
                        .Select(static url => url.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray(),
                    Username = username,
                    Credential = credential
                }
            ],
            ExpiresAt = expiresAt
        };
    }

    internal static string CreateCredential(string sharedSecret, string username)
    {
        var key = Encoding.UTF8.GetBytes(sharedSecret);
        var message = Encoding.UTF8.GetBytes(username);
        var signature = HMACSHA1.HashData(key, message);
        return Convert.ToBase64String(signature);
    }
}
