using ArcaneLink.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace ArcaneLink.Middleware;

public sealed class SecurityHeadersMiddleware
{
    public const string ContentSecurityPolicyHeader = "Content-Security-Policy";
    public const string ContentSecurityPolicyReportOnlyHeader =
        "Content-Security-Policy-Report-Only";
    public const string PermissionsPolicyHeader = "Permissions-Policy";

    private readonly RequestDelegate _next;
    private readonly SecurityHeadersOptions _options;

    public SecurityHeadersMiddleware(
        RequestDelegate next,
        IOptions<SecurityHeadersOptions> options)
    {
        this._next = next;
        this._options = options.Value;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            ApplyHeaders(context.Response.Headers, this._options);
            return Task.CompletedTask;
        });

        await this._next(context);
    }

    public static void ApplyHeaders(
        IHeaderDictionary headers,
        SecurityHeadersOptions options)
    {
        headers[HeaderNames.XContentTypeOptions] = "nosniff";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers[HeaderNames.XFrameOptions] = "DENY";
        headers[PermissionsPolicyHeader] = options.PermissionsPolicy;

        headers.Remove(ContentSecurityPolicyHeader);
        headers.Remove(ContentSecurityPolicyReportOnlyHeader);

        if (!options.ContentSecurityPolicyEnabled)
        {
            return;
        }

        var headerName = options.ContentSecurityPolicyReportOnly
            ? ContentSecurityPolicyReportOnlyHeader
            : ContentSecurityPolicyHeader;
        headers[headerName] = options.ContentSecurityPolicy;
    }
}
