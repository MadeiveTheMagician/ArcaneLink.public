using ArcaneLink.Configuration;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace ArcaneLink.Tests.Configuration;

public sealed class ProductionConfigurationValidatorTests
{
    [Fact]
    public void Validate_AllowsDevelopmentPlaceholdersOutsideProduction()
    {
        var configuration = CreateConfiguration(
            jwtSecret: ProductionConfigurationValidator.DevelopmentJwtSecret,
            connectionString: "Host=localhost;Password=CHANGE_ME",
            allowedHosts: "*");

        ProductionConfigurationValidator.Validate(
            configuration,
            new TestWebHostEnvironment(Environments.Development));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_RejectsMissingConnectionStringInAnyEnvironment(string connectionString)
    {
        var configuration = CreateConfiguration(
            jwtSecret: ProductionConfigurationValidator.DevelopmentJwtSecret,
            connectionString: connectionString,
            allowedHosts: "*");

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Development)));

        Assert.Contains("ConnectionStrings:DefaultConnection", exception.Message);
    }

    [Theory]
    [InlineData("", "Host=db;Password=strong-password", "arcane-link.ru")]
    [InlineData(ProductionConfigurationValidator.DevelopmentJwtSecret, "Host=db;Password=strong-password", "arcane-link.ru")]
    [InlineData("replace-with-at-least-32-random-characters", "Host=db;Password=strong-password", "arcane-link.ru")]
    [InlineData("production-secret-key-with-more-than-32-chars", "", "arcane-link.ru")]
    [InlineData("production-secret-key-with-more-than-32-chars", "Host=db;Password=CHANGE_ME", "arcane-link.ru")]
    [InlineData("production-secret-key-with-more-than-32-chars", "Host=db;Password=replace-with-a-long-random-database-password", "arcane-link.ru")]
    [InlineData("production-secret-key-with-more-than-32-chars", "Host=db;Password=strong-password", "")]
    [InlineData("production-secret-key-with-more-than-32-chars", "Host=db;Password=strong-password", "*")]
    public void Validate_RejectsUnsafeProductionConfiguration(
        string jwtSecret,
        string connectionString,
        string allowedHosts)
    {
        var configuration = CreateConfiguration(jwtSecret, connectionString, allowedHosts);

        Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Production)));
    }

    [Fact]
    public void Validate_AllowsExplicitProductionConfiguration()
    {
        var configuration = CreateConfiguration(
            jwtSecret: "production-secret-key-with-more-than-32-chars",
            connectionString: "Host=db;Password=strong-password",
            allowedHosts: "arcane-link.ru;www.arcane-link.ru");

        ProductionConfigurationValidator.Validate(
            configuration,
            new TestWebHostEnvironment(Environments.Production));
    }

    [Fact]
    public void Validate_RejectsProductionWithoutTurnCredentialIssuer()
    {
        var configuration = CreateConfiguration(
            jwtSecret: "production-secret-key-with-more-than-32-chars",
            connectionString: "Host=db;Password=strong-password",
            allowedHosts: "arcane-link.ru",
            overrides: new Dictionary<string, string?>
            {
                ["TurnCredentials:Enabled"] = "false"
            });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Production)));

        Assert.Contains("relay-only TURN", exception.Message);
    }

    [Fact]
    public void Validate_RejectsDisabledProductionContentSecurityPolicy()
    {
        var configuration = CreateConfiguration(
            jwtSecret: "production-secret-key-with-more-than-32-chars",
            connectionString: "Host=db;Password=strong-password",
            allowedHosts: "arcane-link.ru",
            overrides: new Dictionary<string, string?>
            {
                ["SecurityHeaders:ContentSecurityPolicyEnabled"] = "false"
            });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Production)));

        Assert.Contains("ContentSecurityPolicyEnabled", exception.Message);
    }

    [Fact]
    public void Validate_RejectsUnsafeEvalInProductionContentSecurityPolicy()
    {
        var configuration = CreateConfiguration(
            jwtSecret: "production-secret-key-with-more-than-32-chars",
            connectionString: "Host=db;Password=strong-password",
            allowedHosts: "arcane-link.ru",
            overrides: new Dictionary<string, string?>
            {
                ["SecurityHeaders:ContentSecurityPolicy"] =
                    SecurityHeadersOptions.DefaultContentSecurityPolicy +
                    "; script-src 'self' 'unsafe-eval'"
            });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Production)));

        Assert.Contains("unsafe-eval", exception.Message);
    }

    [Fact]
    public void Validate_RejectsProductionWithoutTrustedReverseProxy()
    {
        var configuration = CreateConfiguration(
            jwtSecret: "production-secret-key-with-more-than-32-chars",
            connectionString: "Host=db;Password=strong-password",
            allowedHosts: "arcane-link.ru",
            includeKnownProxy: false);

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Production)));

        Assert.Contains("known proxy or network", exception.Message);
    }

    [Theory]
    [InlineData("ForwardedHeaders:KnownNetworks:0", "0.0.0.0/0")]
    [InlineData("ForwardedHeaders:KnownNetworks:0", "::/0")]
    [InlineData("ForwardedHeaders:KnownNetworks:0", "not-a-network")]
    [InlineData("ForwardedHeaders:KnownProxies:1", "0.0.0.0")]
    [InlineData("ForwardedHeaders:ForwardLimit", "0")]
    [InlineData("ForwardedHeaders:RequireHeaderSymmetry", "false")]
    public void Validate_RejectsUnsafeProductionForwardingBoundary(
        string key,
        string value)
    {
        var configuration = CreateConfiguration(
            jwtSecret: "production-secret-key-with-more-than-32-chars",
            connectionString: "Host=db;Password=strong-password",
            allowedHosts: "arcane-link.ru",
            overrides: new Dictionary<string, string?>
            {
                [key] = value
            });

        Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Production)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("relative/path")]
    public void Validate_RejectsMissingOrRelativeProductionDataProtectionPath(
        string dataProtectionKeysPath)
    {
        var configuration = CreateConfiguration(
            jwtSecret: "production-secret-key-with-more-than-32-chars",
            connectionString: "Host=db;Password=strong-password",
            allowedHosts: "arcane-link.ru",
            dataProtectionKeysPath: dataProtectionKeysPath);

        var exception = Assert.Throws<InvalidOperationException>(() =>
            ProductionConfigurationValidator.Validate(
                configuration,
                new TestWebHostEnvironment(Environments.Production)));

        Assert.Contains("DataProtection:KeysPath", exception.Message);
    }

    private static IConfiguration CreateConfiguration(
        string jwtSecret,
        string connectionString,
        string allowedHosts,
        string? dataProtectionKeysPath = null,
        IReadOnlyDictionary<string, string?>? overrides = null,
        bool includeKnownProxy = true)
    {
        var values = new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = jwtSecret,
            ["ConnectionStrings:DefaultConnection"] = connectionString,
            ["AllowedHosts"] = allowedHosts,
            ["DataProtection:KeysPath"] =
                dataProtectionKeysPath ?? Path.GetFullPath("data-protection-keys"),
            ["TurnCredentials:Enabled"] = "true",
            ["TurnCredentials:SharedSecret"] =
                "production-turn-shared-secret-with-more-than-32-chars",
            ["TurnCredentials:TtlSeconds"] = "600",
            ["TurnCredentials:Urls:0"] =
                "turn:arcane-link.ru:3478?transport=udp"
        };
        if (includeKnownProxy)
        {
            values["ForwardedHeaders:KnownProxies:0"] = "127.0.0.1";
        }

        if (overrides is not null)
        {
            foreach (var (key, value) in overrides)
            {
                values[key] = value;
            }
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
    }

    private sealed class TestWebHostEnvironment : IWebHostEnvironment
    {
        public TestWebHostEnvironment(string environmentName)
        {
            EnvironmentName = environmentName;
        }

        public string ApplicationName { get; set; } = "ArcaneLink.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; }
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
