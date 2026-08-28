using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Assets
{
    public sealed class AssetCleanupHostedService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly AssetCleanupOptions _options;
        private readonly ILogger<AssetCleanupHostedService> _logger;

        public AssetCleanupHostedService(
            IServiceScopeFactory scopeFactory,
            IOptions<AssetCleanupOptions> options,
            ILogger<AssetCleanupHostedService> logger)
        {
            this._scopeFactory = scopeFactory;
            this._options = options.Value;
            this._logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!this._options.Enabled)
            {
                this._logger.LogInformation("Asset cleanup is disabled.");
                return;
            }

            await this.RunCleanupSafelyAsync(stoppingToken);

            using var timer = new PeriodicTimer(
                TimeSpan.FromMinutes(Math.Max(1, this._options.IntervalMinutes)));

            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await this.RunCleanupSafelyAsync(stoppingToken);
            }
        }

        private async Task RunCleanupSafelyAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = this._scopeFactory.CreateScope();
                var runner = scope.ServiceProvider.GetRequiredService<AssetCleanupRunner>();
                await runner.RunOnceAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
            }
            catch (Exception exception)
            {
                this._logger.LogError(
                    exception,
                    "Asset cleanup failed.");
            }
        }
    }
}
