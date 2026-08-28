using ArcaneLink.Configuration;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Email;

public sealed class EmailOutboxHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly EmailOutboxOptions _options;
    private readonly EmailDeliveryOptions _deliveryOptions;
    private readonly ILogger<EmailOutboxHostedService> _logger;

    public EmailOutboxHostedService(
        IServiceScopeFactory scopeFactory,
        IOptions<EmailOutboxOptions> options,
        IOptions<EmailDeliveryOptions> deliveryOptions,
        ILogger<EmailOutboxHostedService> logger)
    {
        this._scopeFactory = scopeFactory;
        this._options = options.Value;
        this._deliveryOptions = deliveryOptions.Value;
        this._logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!this._deliveryOptions.Enabled)
        {
            this._logger.LogWarning(
                "Email delivery is disabled. Account emails will remain safely queued until SMTP is configured and the service is restarted.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = false;
            try
            {
                await using var scope = this._scopeFactory.CreateAsyncScope();
                var processor = scope.ServiceProvider.GetRequiredService<EmailOutboxProcessor>();
                processed = await processor.ProcessOneAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                this._logger.LogError(
                    exception,
                    "Email outbox polling failed; the worker will retry after the poll interval.");
            }

            if (!processed)
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(this._options.PollIntervalSeconds),
                    stoppingToken);
            }
        }
    }
}
