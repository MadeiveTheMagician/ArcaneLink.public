using System.Globalization;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.RateLimiting;
using ArcaneLink.Configuration;
using ArcaneLink.Observability;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Extensions;

public static class RateLimitingExtensions
{
    private static readonly JsonSerializerOptions ProblemJsonOptions =
        new(JsonSerializerDefaults.Web);

    public static IServiceCollection AddArcaneLinkRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var section = configuration.GetSection(AbuseProtectionOptions.SectionName);
        services
            .AddOptions<AbuseProtectionOptions>()
            .Bind(section)
            .Validate(
                settings => HasValidRules(settings),
                "Every rate-limit permit and window value must be greater than zero.")
            .ValidateOnStart();
        services.AddRateLimiter(options =>
        {
            AddFixedWindowPolicy(
                options,
                AbuseRateLimitPolicyNames.Auth,
                settings => settings.Auth);
            AddFixedWindowPolicy(
                options,
                AbuseRateLimitPolicyNames.Uploads,
                settings => settings.Uploads);
            AddFixedWindowPolicy(
                options,
                AbuseRateLimitPolicyNames.Invites,
                settings => settings.Invites);
            AddFixedWindowPolicy(
                options,
                AbuseRateLimitPolicyNames.DiscoverySearch,
                settings => settings.DiscoverySearch);
            AddFixedWindowPolicy(
                options,
                AbuseRateLimitPolicyNames.SignalRConnect,
                settings => settings.SignalRConnect);
            AddFixedWindowPolicy(
                options,
                AbuseRateLimitPolicyNames.ModerationReports,
                settings => settings.ModerationReports);
            AddFixedWindowPolicy(
                options,
                AbuseRateLimitPolicyNames.TurnCredentials,
                settings => settings.TurnCredentials);

            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = WriteRejectedResponseAsync;
        });

        return services;
    }

    public static string GetRateLimitPartitionKey(HttpContext context)
    {
        var userIdValue = context.User.FindFirstValue("userId");
        if (Guid.TryParse(userIdValue, out var userId))
        {
            return $"user:{userId:N}";
        }

        return $"ip:{NormalizeIpAddress(context.Connection.RemoteIpAddress)}";
    }

    private static void AddFixedWindowPolicy(
        RateLimiterOptions options,
        string policyName,
        Func<AbuseProtectionOptions, RateLimitRuleOptions> selectSettings)
    {
        options.AddPolicy(
            policyName,
            context =>
            {
                var settings = selectSettings(context.RequestServices
                    .GetRequiredService<IOptions<AbuseProtectionOptions>>()
                    .Value);

                return RateLimitPartition.GetFixedWindowLimiter(
                    GetRateLimitPartitionKey(context),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = settings.PermitLimit,
                        Window = TimeSpan.FromSeconds(settings.WindowSeconds),
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        AutoReplenishment = true
                    });
            });
    }

    private static bool HasValidRules(AbuseProtectionOptions settings)
    {
        try
        {
            settings.Validate();
            return true;
        }
        catch (Exception exception) when (
            exception is InvalidOperationException or ArgumentNullException)
        {
            return false;
        }
    }

    private static async ValueTask WriteRejectedResponseAsync(
        OnRejectedContext rejectedContext,
        CancellationToken cancellationToken)
    {
        var httpContext = rejectedContext.HttpContext;
        var policyName = httpContext.GetEndpoint()?
            .Metadata
            .GetMetadata<EnableRateLimitingAttribute>()?
            .PolicyName
            ?? "unknown";
        var retryAfter = rejectedContext.Lease.TryGetMetadata(
            MetadataName.RetryAfter,
            out TimeSpan retryAfterMetadata)
                ? retryAfterMetadata
                : TimeSpan.FromSeconds(1);
        var retryAfterSeconds = Math.Max(
            1,
            (int)Math.Ceiling(retryAfter.TotalSeconds));
        var partitionKey = GetRateLimitPartitionKey(httpContext);

        ArcaneLinkDiagnostics.RateLimitedRequestCounter.Add(
            1,
            new KeyValuePair<string, object?>("policy", policyName));

        var logger = httpContext.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("ArcaneLink.RateLimiting");
        logger.LogWarning(
            ObservabilityEventIds.HttpRequestRateLimited,
            "Request rate limited. Policy={PolicyName} Partition={PartitionKey} Method={Method} Path={Path} RetryAfterSeconds={RetryAfterSeconds} TraceIdentifier={TraceIdentifier}",
            policyName,
            partitionKey,
            httpContext.Request.Method,
            HttpRequestLogValues.GetSafePath(httpContext),
            retryAfterSeconds,
            httpContext.TraceIdentifier);

        if (httpContext.Response.HasStarted)
        {
            return;
        }

        httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        httpContext.Response.ContentType = "application/problem+json";
        httpContext.Response.Headers["Retry-After"] =
            retryAfterSeconds.ToString(CultureInfo.InvariantCulture);

        var problem = new ProblemDetails
        {
            Type = "https://www.rfc-editor.org/rfc/rfc6585#section-4",
            Title = "Too many requests.",
            Status = StatusCodes.Status429TooManyRequests,
            Detail = "The request rate limit was exceeded. Retry after the indicated delay.",
            Instance = httpContext.Request.Path
        };
        problem.Extensions["policy"] = policyName;
        problem.Extensions["traceId"] = httpContext.TraceIdentifier;
        problem.Extensions["retryAfterSeconds"] = retryAfterSeconds;

        await JsonSerializer.SerializeAsync(
            httpContext.Response.Body,
            problem,
            ProblemJsonOptions,
            cancellationToken);
    }

    private static string NormalizeIpAddress(IPAddress? address)
    {
        if (address == null)
        {
            return "unknown";
        }

        var normalized = address.IsIPv4MappedToIPv6
            ? address.MapToIPv4()
            : address;

        return normalized.ToString().ToLowerInvariant();
    }
}
