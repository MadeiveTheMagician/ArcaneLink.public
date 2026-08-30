using ArcaneLink.DataBase._Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ArcaneLink.Observability.HealthChecks;

public sealed class MigrationsHealthCheck : IHealthCheck
{
    private readonly AppDbContext _db;

    public MigrationsHealthCheck(AppDbContext db)
    {
        this._db = db;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var pendingMigrations = await this._db.Database
            .GetPendingMigrationsAsync(cancellationToken);
        var pendingMigrationList = pendingMigrations.ToList();

        return pendingMigrationList.Count == 0
            ? HealthCheckResult.Healthy("All EF Core migrations are applied.")
            : HealthCheckResult.Unhealthy(
                "EF Core migrations are pending.",
                data: new Dictionary<string, object>
                {
                    ["pendingMigrations"] = pendingMigrationList
                });
    }
}
