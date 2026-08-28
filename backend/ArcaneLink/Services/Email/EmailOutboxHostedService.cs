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
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _deliveryOptions = deliveryOptions.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_deliveryOptions.Enabled)
        {
            _logger.LogWarning(
                "Email delivery is disabled. Account emails will remain safely queued until SMTP is configured and the service is restarted.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = false;
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var processor = scope.ServiceProvider.GetRequiredService<EmailOutboxProcessor>();
                processed = await processor.ProcessOneAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Email outbox polling failed; the worker will retry after the poll interval.");
            }

            if (!processed)
            {
                await Task.Delay(
                    TimeSpan.FromSeconds(_options.PollIntervalSeconds),
                    stoppingToken);
            }
        }
    }
}
