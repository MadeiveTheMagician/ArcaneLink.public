using System.Data;
using System.Text.Json;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.Email.Abstractions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Email;

public sealed class EmailOutboxProcessor
{
    private const string ProtectorPurpose = "ArcaneLink.EmailOutbox.Payload.v1";
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;
    private readonly IAccountLifecycleService _accountLifecycle;
    private readonly IEmailSender _emailSender;
    private readonly IDataProtector _protector;
    private readonly EmailOutboxOptions _options;
    private readonly ILogger<EmailOutboxProcessor> _logger;

    public EmailOutboxProcessor(
        AppDbContext db,
        IAccountLifecycleService accountLifecycle,
        IEmailSender emailSender,
        IDataProtectionProvider dataProtection,
        IOptions<EmailOutboxOptions> options,
        ILogger<EmailOutboxProcessor> logger)
    {
        this._db = db;
        this._accountLifecycle = accountLifecycle;
        this._emailSender = emailSender;
        this._protector = dataProtection.CreateProtector(ProtectorPurpose);
        this._options = options.Value;
        this._logger = logger;
    }

    public async Task<bool> ProcessOneAsync(
        CancellationToken cancellationToken = default)
    {
        var claim = await this.TryClaimAsync(cancellationToken);
        if (claim is null)
        {
            return false;
        }

        try
        {
            if (claim.Kind == EmailOutboxKinds.Send)
            {
                var email = this.Unprotect<OutboxEmail>(claim.ProtectedPayload);
                await this._emailSender.SendAsync(
                    email.Recipient,
                    email.Subject,
                    email.TextBody,
                    email.HtmlBody,
                    cancellationToken);
                claim.ProcessedAt = DateTime.UtcNow;
                claim.LeaseId = null;
                claim.LeaseExpiresAt = null;
                claim.LastError = null;
                await this._db.SaveChangesAsync(cancellationToken);
                return true;
            }

            if (claim.Kind is EmailOutboxKinds.VerificationLookup or
                EmailOutboxKinds.PasswordResetLookup)
            {
                await this.PrepareLookupAsync(claim, cancellationToken);
                return true;
            }

            throw new InvalidOperationException("Unsupported email outbox kind.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            await this.ScheduleRetryAsync(claim.Id, claim.LeaseId, exception, cancellationToken);
            return true;
        }
    }

    private async Task<EmailOutboxMessage?> TryClaimAsync(
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var candidateId = await this._db.EmailOutboxMessages
            .AsNoTracking()
            .Where(x => x.ProcessedAt == null &&
                        x.DeadLetteredAt == null &&
                        x.AvailableAt <= now &&
                        (x.LeaseExpiresAt == null || x.LeaseExpiresAt <= now))
            .OrderBy(x => x.CreatedAt)
            .Select(x => (Guid?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (candidateId is null)
        {
            return null;
        }

        var leaseId = Guid.NewGuid();
        var affected = await this._db.EmailOutboxMessages
            .Where(x => x.Id == candidateId.Value &&
                        x.ProcessedAt == null &&
                        x.DeadLetteredAt == null &&
                        x.AvailableAt <= now &&
                        (x.LeaseExpiresAt == null || x.LeaseExpiresAt <= now))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.LeaseId, leaseId)
                    .SetProperty(
                        x => x.LeaseExpiresAt,
                        now.AddSeconds(this._options.LeaseSeconds))
                    .SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1),
                cancellationToken);
        if (affected == 0)
        {
            return null;
        }

        return await this._db.EmailOutboxMessages.FirstAsync(
            x => x.Id == candidateId.Value && x.LeaseId == leaseId,
            cancellationToken);
    }

    private async Task PrepareLookupAsync(
        EmailOutboxMessage claim,
        CancellationToken cancellationToken)
    {
        await using var transaction = await this._db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var lookup = this.Unprotect<EmailLookupPayload>(claim.ProtectedPayload);
        var email = await this._accountLifecycle.PrepareDeferredEmailAsync(
            claim.Kind,
            lookup.Lookup,
            cancellationToken);
        if (email is null)
        {
            claim.ProcessedAt = DateTime.UtcNow;
            claim.LeaseId = null;
            claim.LeaseExpiresAt = null;
        }
        else
        {
            claim.Kind = EmailOutboxKinds.Send;
            claim.ProtectedPayload = this.Protect(email);
            claim.AvailableAt = DateTime.UtcNow;
            claim.AttemptCount = 0;
            claim.LeaseId = null;
            claim.LeaseExpiresAt = null;
            claim.LastError = null;
        }

        await this._db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task ScheduleRetryAsync(
        Guid messageId,
        Guid? leaseId,
        Exception exception,
        CancellationToken cancellationToken)
    {
        this._db.ChangeTracker.Clear();
        var message = await this._db.EmailOutboxMessages.FirstOrDefaultAsync(
            x => x.Id == messageId && x.LeaseId == leaseId,
            cancellationToken);
        if (message is null)
        {
            return;
        }

        message.LeaseId = null;
        message.LeaseExpiresAt = null;
        message.LastError = LimitError(exception.GetType().Name);
        if (message.AttemptCount >= this._options.MaxAttempts)
        {
            message.DeadLetteredAt = DateTime.UtcNow;
            this._logger.LogError(
                "Email outbox message moved to dead letter. MessageId={MessageId} Kind={Kind} Attempts={Attempts}",
                message.Id,
                message.Kind,
                message.AttemptCount);
        }
        else
        {
            var delayMinutes = Math.Min(
                Math.Pow(2, Math.Max(0, message.AttemptCount - 1)),
                this._options.MaxBackoffMinutes);
            message.AvailableAt = DateTime.UtcNow.AddMinutes(delayMinutes);
            this._logger.LogWarning(
                "Email outbox delivery failed and will retry. MessageId={MessageId} Kind={Kind} Attempt={Attempt}",
                message.Id,
                message.Kind,
                message.AttemptCount);
        }

        await this._db.SaveChangesAsync(cancellationToken);
    }

    private T Unprotect<T>(string protectedPayload) =>
        JsonSerializer.Deserialize<T>(
            this._protector.Unprotect(protectedPayload),
            JsonOptions) ?? throw new InvalidOperationException("Email outbox payload is invalid.");

    private string Protect<T>(T payload) =>
        this._protector.Protect(JsonSerializer.Serialize(payload, JsonOptions));

    private static string LimitError(string value) =>
        value.Length <= 512 ? value : value[..512];
}
