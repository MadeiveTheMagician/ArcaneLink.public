using Microsoft.AspNetCore.Routing;

namespace ArcaneLink.Observability;

public static class HttpRequestLogValues
{
    private const string MatchedRouteFallback = "<matched>";
    private const string UnmatchedRoute = "<unmatched>";

    public static string GetSafePath(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        if (context.GetEndpoint() is not RouteEndpoint routeEndpoint)
        {
            return UnmatchedRoute;
        }

        var routePattern = routeEndpoint.RoutePattern.RawText;
        if (string.IsNullOrWhiteSpace(routePattern))
        {
            return MatchedRouteFallback;
        }

        return routePattern.StartsWith('/')
            ? routePattern
            : $"/{routePattern}";
    }
}
