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
            _scopeFactory = scopeFactory;
            _options = options.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_options.Enabled)
            {
                _logger.LogInformation("Asset cleanup is disabled.");
                return;
            }

            await RunCleanupSafelyAsync(stoppingToken);

            using var timer = new PeriodicTimer(
                TimeSpan.FromMinutes(Math.Max(1, _options.IntervalMinutes)));

            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunCleanupSafelyAsync(stoppingToken);
            }
        }

        private async Task RunCleanupSafelyAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var runner = scope.ServiceProvider.GetRequiredService<AssetCleanupRunner>();
                await runner.RunOnceAsync(cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Asset cleanup failed.");
            }
        }
    }
}
