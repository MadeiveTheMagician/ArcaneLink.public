using ArcaneLink.Observability;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;

namespace ArcaneLink.Tests.Observability;

public sealed class HttpRequestLogValuesTests
{
    [Fact]
    public void GetSafePath_UsesRoutePatternInsteadOfSensitiveRouteValue()
    {
        const string inviteCode = "secret-invite-code";
        var context = new DefaultHttpContext();
        context.Request.Path = $"/api/server-invites/{inviteCode}";
        context.SetEndpoint(new RouteEndpoint(
            _ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/server-invites/{code}"),
            order: 0,
            EndpointMetadataCollection.Empty,
            displayName: "Invite preview"));

        var safePath = HttpRequestLogValues.GetSafePath(context);

        Assert.Equal("/api/server-invites/{code}", safePath);
        Assert.DoesNotContain(inviteCode, safePath, StringComparison.Ordinal);
    }

    [Fact]
    public void GetSafePath_DoesNotLogArbitraryUnmatchedPath()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/raw-secret-from-client";

        var safePath = HttpRequestLogValues.GetSafePath(context);

        Assert.Equal("<unmatched>", safePath);
    }
}
