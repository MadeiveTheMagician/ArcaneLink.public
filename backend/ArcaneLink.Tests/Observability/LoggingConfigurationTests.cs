using ArcaneLink.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Tests.Observability;

public sealed class LoggingConfigurationTests
{
    [Theory]
    [InlineData("Development", "simple")]
    [InlineData("Testing", "simple")]
    [InlineData("Docker", "json")]
    [InlineData("Production", "json")]
    [InlineData("Staging", "json")]
    public void AddArcaneLinkLogging_SelectsExpectedConsoleFormatter(
        string environmentName,
        string expectedFormatterName)
    {
        var services = new ServiceCollection();
        services.AddLogging(logging => logging.AddArcaneLinkLogging(
            new TestHostEnvironment(environmentName)));

        using var serviceProvider = services.BuildServiceProvider();
        var options = serviceProvider
            .GetRequiredService<IOptions<ConsoleLoggerOptions>>()
            .Value;

        Assert.Equal(expectedFormatterName, options.FormatterName);
    }

    [Fact]
    public void AddArcaneLinkLogging_ConfiguresJsonConsoleForUtcScopedOutput()
    {
        var services = new ServiceCollection();
        services.AddLogging(logging => logging.AddArcaneLinkLogging(
            new TestHostEnvironment(Environments.Production)));

        using var serviceProvider = services.BuildServiceProvider();
        var options = serviceProvider
            .GetRequiredService<IOptions<JsonConsoleFormatterOptions>>()
            .Value;

        Assert.True(options.IncludeScopes);
        Assert.True(options.UseUtcTimestamp);
        Assert.Equal("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", options.TimestampFormat);
    }

    [Fact]
    public void AddArcaneLinkLogging_ConfiguresHumanReadableConsoleForScopedSingleLineOutput()
    {
        var services = new ServiceCollection();
        services.AddLogging(logging => logging.AddArcaneLinkLogging(
            new TestHostEnvironment(Environments.Development)));

        using var serviceProvider = services.BuildServiceProvider();
        var options = serviceProvider
            .GetRequiredService<IOptions<SimpleConsoleFormatterOptions>>()
            .Value;

        Assert.True(options.IncludeScopes);
        Assert.True(options.SingleLine);
        Assert.Equal("HH:mm:ss ", options.TimestampFormat);
    }

    [Fact]
    public void AddArcaneLinkLogging_DoesNotAutomaticallyLogActivityBaggageOrTags()
    {
        var services = new ServiceCollection();
        services.AddLogging(logging => logging.AddArcaneLinkLogging(
            new TestHostEnvironment(Environments.Production)));

        using var serviceProvider = services.BuildServiceProvider();
        var options = serviceProvider
            .GetRequiredService<IOptions<LoggerFactoryOptions>>()
            .Value;

        Assert.Equal(
            ActivityTrackingOptions.TraceId |
            ActivityTrackingOptions.SpanId |
            ActivityTrackingOptions.ParentId,
            options.ActivityTrackingOptions);
        Assert.False(options.ActivityTrackingOptions.HasFlag(
            ActivityTrackingOptions.Baggage));
        Assert.False(options.ActivityTrackingOptions.HasFlag(
            ActivityTrackingOptions.Tags));
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public TestHostEnvironment(string environmentName)
        {
            this.EnvironmentName = environmentName;
        }

        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; } = "ArcaneLink.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } =
            new NullFileProvider();
    }
}
