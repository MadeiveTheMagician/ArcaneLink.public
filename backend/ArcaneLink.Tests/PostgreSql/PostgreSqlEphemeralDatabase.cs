using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ArcaneLink.Tests.PostgreSql;

internal sealed class PostgreSqlEphemeralDatabase : IAsyncDisposable
{
    internal const string RequiredDatabasePrefix = "arcanelink_test_";
    private const string ConnectionEnvironmentVariable =
        "ARCANELINK_TEST_POSTGRES_CONNECTION";

    private readonly string _adminConnectionString;
    private int _disposed;

    private PostgreSqlEphemeralDatabase(
        string databaseName,
        string adminConnectionString,
        string connectionString)
    {
        this.DatabaseName = databaseName;
        this._adminConnectionString = adminConnectionString;
        this.ConnectionString = connectionString;
    }

    public string DatabaseName { get; }

    public string ConnectionString { get; }

    public static async Task<PostgreSqlEphemeralDatabase> CreateAsync()
    {
        var configuredConnectionString = Environment.GetEnvironmentVariable(
            ConnectionEnvironmentVariable);
        if (string.IsNullOrWhiteSpace(configuredConnectionString))
        {
            throw new InvalidOperationException(
                $"{ConnectionEnvironmentVariable} must contain a PostgreSQL " +
                $"connection string whose database starts with '{RequiredDatabasePrefix}'.");
        }

        var adminBuilder = new NpgsqlConnectionStringBuilder(configuredConnectionString);
        EnsureSafeConfiguredDatabase(adminBuilder.Database);
        DisablePooling(adminBuilder);

        var databaseName = $"{RequiredDatabasePrefix}{Guid.NewGuid():N}";
        EnsureSafeEphemeralDatabase(databaseName);

        var databaseBuilder = new NpgsqlConnectionStringBuilder(adminBuilder.ConnectionString)
        {
            Database = databaseName,
        };
        DisablePooling(databaseBuilder);

        var created = false;
        try
        {
            await using var adminConnection =
                new NpgsqlConnection(adminBuilder.ConnectionString);
            await adminConnection.OpenAsync();

            await using var createCommand = adminConnection.CreateCommand();
            createCommand.CommandText = $"CREATE DATABASE {QuoteIdentifier(databaseName)};";
            await createCommand.ExecuteNonQueryAsync();
            created = true;

            return new PostgreSqlEphemeralDatabase(
                databaseName,
                adminBuilder.ConnectionString,
                databaseBuilder.ConnectionString);
        }
        catch
        {
            if (created)
            {
                await DropDatabaseAsync(adminBuilder.ConnectionString, databaseName);
            }

            throw;
        }
    }

    public AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(this.ConnectionString)
            .Options;
        return new AppDbContext(options);
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref this._disposed, 1) != 0)
        {
            return;
        }

        await DropDatabaseAsync(this._adminConnectionString, this.DatabaseName);
    }

    private static void EnsureSafeConfiguredDatabase(string? databaseName)
    {
        if (string.IsNullOrWhiteSpace(databaseName) ||
            !databaseName.StartsWith(RequiredDatabasePrefix, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Refusing PostgreSQL test setup because the configured database name " +
                $"does not start with '{RequiredDatabasePrefix}'.");
        }
    }

    private static void EnsureSafeEphemeralDatabase(string databaseName)
    {
        if (!databaseName.StartsWith(RequiredDatabasePrefix, StringComparison.Ordinal) ||
            databaseName.Length > 63 ||
            databaseName.Any(character =>
                character is not ('_' or >= 'a' and <= 'z' or >= '0' and <= '9')))
        {
            throw new InvalidOperationException(
                $"Refusing unsafe ephemeral database name '{databaseName}'.");
        }
    }

    private static void DisablePooling(NpgsqlConnectionStringBuilder builder)
    {
        builder.Multiplexing = false;
        builder.Pooling = false;
    }

    private static async Task DropDatabaseAsync(
        string adminConnectionString,
        string databaseName)
    {
        EnsureSafeEphemeralDatabase(databaseName);

        await using var adminConnection = new NpgsqlConnection(adminConnectionString);
        await adminConnection.OpenAsync();

        await using var dropCommand = adminConnection.CreateCommand();
        dropCommand.CommandText =
            $"DROP DATABASE IF EXISTS {QuoteIdentifier(databaseName)} WITH (FORCE);";
        await dropCommand.ExecuteNonQueryAsync();
    }

    private static string QuoteIdentifier(string identifier) =>
        $"\"{identifier.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
}
