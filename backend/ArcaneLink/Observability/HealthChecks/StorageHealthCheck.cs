using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ArcaneLink.Observability.HealthChecks
{
    public sealed class StorageHealthCheck : IHealthCheck
    {
        private readonly IWebHostEnvironment _environment;

        public StorageHealthCheck(IWebHostEnvironment environment)
        {
            this._environment = environment;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            var storageRoot = Path.GetFullPath(
                Path.Combine(this._environment.ContentRootPath, "storage"));

            try
            {
                Directory.CreateDirectory(storageRoot);

                var probePath = Path.Combine(
                    storageRoot,
                    $".health-{Guid.NewGuid():N}.tmp");

                await File.WriteAllTextAsync(
                    probePath,
                    "ok",
                    cancellationToken);

                File.Delete(probePath);

                return HealthCheckResult.Healthy("Storage directory is readable and writable.");
            }
            catch (Exception exception)
            {
                return HealthCheckResult.Unhealthy(
                    "Storage directory is not readable and writable.",
                    exception);
            }
        }
    }
}
