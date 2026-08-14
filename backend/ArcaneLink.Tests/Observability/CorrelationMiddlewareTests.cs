using ArcaneLink.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace ArcaneLink.Tests.Observability;

public sealed class CorrelationMiddlewareTests
{
    [Theory]
    [InlineData("request-01")]
    [InlineData("4bf92f3577b34da6a3ce929d0e0e4736")]
    [InlineData("client.scope:42_value")]
    public async Task InvokeAsync_PreservesSafeClientCorrelationId(string correlationId)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationMiddleware.HeaderName] = correlationId;
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(context);

        Assert.Equal(correlationId, context.TraceIdentifier);
        Assert.Equal(
            correlationId,
            context.Response.Headers[CorrelationMiddleware.HeaderName].ToString());
    }

    [Theory]
    [InlineData("contains whitespace")]
    [InlineData("contains\ttab")]
    [InlineData("кириллица")]
    [InlineData("value/with/slashes")]
    public async Task InvokeAsync_ReplacesUnsafeClientCorrelationId(string correlationId)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationMiddleware.HeaderName] = correlationId;
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(context);

        Assert.NotEqual(correlationId, context.TraceIdentifier);
        Assert.Equal(
            context.TraceIdentifier,
            context.Response.Headers[CorrelationMiddleware.HeaderName].ToString());
    }

    [Fact]
    public async Task InvokeAsync_ReplacesOversizedClientCorrelationId()
    {
        var correlationId = new string('a', 129);
        var context = new DefaultHttpContext();
        context.Request.Headers[CorrelationMiddleware.HeaderName] = correlationId;
        var middleware = CreateMiddleware();

        await middleware.InvokeAsync(context);

        Assert.NotEqual(correlationId, context.TraceIdentifier);
    }

    private static CorrelationMiddleware CreateMiddleware()
    {
        return new CorrelationMiddleware(
            _ => Task.CompletedTask,
            NullLogger<CorrelationMiddleware>.Instance);
    }
}
