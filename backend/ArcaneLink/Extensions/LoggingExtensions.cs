using Microsoft.Extensions.Logging.Console;

namespace ArcaneLink.Extensions;

public static class LoggingExtensions
{
    private const string TestingEnvironmentName = "Testing";

    public static ILoggingBuilder AddArcaneLinkLogging(
        this ILoggingBuilder logging,
        IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(logging);
        ArgumentNullException.ThrowIfNull(environment);

        logging.ClearProviders();

        if (UsesHumanReadableConsole(environment))
        {
            logging.AddSimpleConsole(options =>
            {
                options.IncludeScopes = true;
                options.SingleLine = true;
                options.TimestampFormat = "HH:mm:ss ";
            });
            logging.AddDebug();
        }
        else
        {
            logging.AddJsonConsole(options =>
            {
                options.IncludeScopes = true;
                options.TimestampFormat = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";
                options.UseUtcTimestamp = true;
            });
        }

        logging.Configure(options => options.ActivityTrackingOptions =
            ActivityTrackingOptions.TraceId |
            ActivityTrackingOptions.SpanId |
            ActivityTrackingOptions.ParentId);

        return logging;
    }

    private static bool UsesHumanReadableConsole(IHostEnvironment environment)
    {
        return environment.IsDevelopment() ||
               environment.IsEnvironment(TestingEnvironmentName);
    }
}
