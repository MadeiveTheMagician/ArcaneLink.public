using Xunit;

namespace ArcaneLink.Tests.PostgreSql;

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class PostgreSqlFactAttribute : FactAttribute
{
    public PostgreSqlFactAttribute()
    {
        if (!string.Equals(
                Environment.GetEnvironmentVariable("ARCANELINK_RUN_POSTGRES_TESTS"),
                "1",
                StringComparison.Ordinal))
        {
            this.Skip = "Set ARCANELINK_RUN_POSTGRES_TESTS=1 to run isolated PostgreSQL tests.";
        }
    }
}

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class PostgreSqlCollectionDefinition
{
    public const string Name = "PostgreSQL migration tests";
}
