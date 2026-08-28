using System.Diagnostics;
using ArcaneLink.Observability;

namespace ArcaneLink.Middleware
{
    public sealed class CorrelationMiddleware
    {
        public const string HeaderName = "X-Correlation-ID";

        private readonly RequestDelegate _next;
        private readonly ILogger<CorrelationMiddleware> _logger;

        public CorrelationMiddleware(
            RequestDelegate next,
            ILogger<CorrelationMiddleware> logger)
        {
            this._next = next;
            this._logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var correlationId = ResolveCorrelationId(context);
            context.TraceIdentifier = correlationId;
            context.Response.Headers[HeaderName] = correlationId;

            Activity.Current?.SetTag("correlation.id", correlationId);
            Activity.Current?.SetTag("http.request_id", context.TraceIdentifier);

            using var scope = this._logger.BeginScope(new Dictionary<string, object>
            {
                ["CorrelationId"] = correlationId,
                ["TraceId"] = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier
            });

            var startedAt = Stopwatch.GetTimestamp();
            try
            {
                await this._next(context);
            }
            finally
            {
                var elapsedMs = Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds;
                ArcaneLinkDiagnostics.RequestCounter.Add(
                    1,
                    new KeyValuePair<string, object?>("method", context.Request.Method),
                    new KeyValuePair<string, object?>("status_code", context.Response.StatusCode));

                this._logger.LogInformation(
                    ObservabilityEventIds.HttpRequestCompleted,
                    "HTTP request completed. Method={Method} Path={Path} StatusCode={StatusCode} ElapsedMs={ElapsedMs:0.0} CorrelationId={CorrelationId}",
                    context.Request.Method,
                    HttpRequestLogValues.GetSafePath(context),
                    context.Response.StatusCode,
                    elapsedMs,
                    correlationId);
            }
        }

        private static string ResolveCorrelationId(HttpContext context)
        {
            if (context.Request.Headers.TryGetValue(HeaderName, out var values))
            {
                var value = values.FirstOrDefault();
                if (IsValidClientCorrelationId(value))
                {
                    return value!;
                }
            }

            return Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;
        }

        private static bool IsValidClientCorrelationId(string? value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
            {
                return false;
            }

            return value.All(character =>
                char.IsAsciiLetterOrDigit(character) ||
                character is '-' or '_' or '.' or ':');
        }
    }
}
