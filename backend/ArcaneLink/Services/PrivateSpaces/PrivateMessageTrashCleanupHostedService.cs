namespace ArcaneLink.Services.PrivateSpaces;

public sealed class PrivateMessageTrashCleanupHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PrivateMessageTrashCleanupHostedService> _logger;

    public PrivateMessageTrashCleanupHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<PrivateMessageTrashCleanupHostedService> logger)
    {
        this._scopeFactory = scopeFactory;
        this._logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await this.RunCleanupSafelyAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);
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
            var runner = scope.ServiceProvider
                .GetRequiredService<PrivateMessageTrashCleanupRunner>();
            await runner.RunOnceAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            this._logger.LogError(
                exception,
                "Expired private-message trash cleanup failed.");
        }
    }
}
