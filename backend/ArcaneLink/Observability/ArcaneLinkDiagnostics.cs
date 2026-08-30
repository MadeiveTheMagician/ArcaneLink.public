using System.Diagnostics;
using System.Diagnostics.Metrics;
using Microsoft.Extensions.Logging;

namespace ArcaneLink.Observability;

public static class ArcaneLinkDiagnostics
{
    public const string ActivitySourceName = "ArcaneLink";
    public const string MeterName = "ArcaneLink";

    public static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    public static readonly Meter Meter = new(MeterName);

    public static readonly Counter<long> RequestCounter =
        Meter.CreateCounter<long>("arcanelink.requests", "requests", "Completed HTTP requests.");

    public static readonly Counter<long> RateLimitedRequestCounter =
        Meter.CreateCounter<long>("arcanelink.requests.rate_limited", "requests", "Rate-limited HTTP requests.");

    public static readonly Counter<long> LoginSucceededCounter =
        Meter.CreateCounter<long>("arcanelink.auth.login_succeeded", "events", "Successful logins.");

    public static readonly Counter<long> RefreshTokenRotatedCounter =
        Meter.CreateCounter<long>("arcanelink.auth.refresh_token_rotated", "events", "Refresh token rotations.");

    public static readonly Counter<long> MessageSendFailedCounter =
        Meter.CreateCounter<long>("arcanelink.messages.send_failed", "events", "Failed message send attempts.");

    public static readonly Counter<long> VoiceJoinFailedCounter =
        Meter.CreateCounter<long>("arcanelink.voice.join_failed", "events", "Failed voice join attempts.");

    public static readonly Counter<long> AssetUploadRejectedCounter =
        Meter.CreateCounter<long>("arcanelink.assets.upload_rejected", "events", "Rejected asset uploads.");

    public static readonly Counter<long> AssetPhysicalDeleteFailedCounter =
        Meter.CreateCounter<long>("arcanelink.assets.physical_delete_failed", "events", "Failed physical asset deletes.");

    public static readonly Counter<long> AssetCleanupCandidatesCounter =
        Meter.CreateCounter<long>("arcanelink.assets.cleanup.candidates", "assets", "Assets selected by cleanup passes.");

    public static readonly Counter<long> AssetCleanupDeletedCounter =
        Meter.CreateCounter<long>("arcanelink.assets.cleanup.deleted", "assets", "Assets physically deleted by cleanup passes.");

    public static readonly Counter<long> AssetCleanupFailedCounter =
        Meter.CreateCounter<long>("arcanelink.assets.cleanup.failed", "assets", "Assets that cleanup passes failed to delete.");
}

public static class ObservabilityEventIds
{
    public static readonly EventId HttpRequestCompleted = new(1000, "HttpRequestCompleted");
    public static readonly EventId UnhandledException = new(1001, "UnhandledException");
    public static readonly EventId HttpRequestRateLimited = new(1002, "HttpRequestRateLimited");

    public static readonly EventId UserLoginSucceeded = new(2000, "UserLoginSucceeded");
    public static readonly EventId RefreshTokenRotated = new(2001, "RefreshTokenRotated");

    public static readonly EventId ServerInviteCreated = new(3000, "ServerInviteCreated");
    public static readonly EventId MessageSendFailed = new(4000, "MessageSendFailed");
    public static readonly EventId AssetUploadRejected = new(5000, "AssetUploadRejected");
    public static readonly EventId AssetPhysicalDeleteFailed = new(5001, "AssetPhysicalDeleteFailed");
    public static readonly EventId AssetCleanupCompleted = new(5002, "AssetCleanupCompleted");

    public static readonly EventId SignalRConnectionOpened = new(6000, "SignalRConnectionOpened");
    public static readonly EventId SignalRConnectionClosed = new(6001, "SignalRConnectionClosed");
    public static readonly EventId VoiceJoinStarted = new(6100, "VoiceJoinStarted");
    public static readonly EventId VoiceJoinSucceeded = new(6101, "VoiceJoinSucceeded");
    public static readonly EventId VoiceJoinFailed = new(6102, "VoiceJoinFailed");
    public static readonly EventId VoiceLeaveCompleted = new(6103, "VoiceLeaveCompleted");
}
