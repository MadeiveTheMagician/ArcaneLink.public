using System.Net;
using System.Net.Http.Json;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Services.Email;
using ArcaneLink.Services.Email.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Tests.Auth;

public sealed class EmailOutboxIntegrationTests
{
    [Fact]
    public async Task Registration_EncryptsPayload_AndFailuresRetryThenDeadLetter()
    {
        using var factory = CreateFactory(new ThrowingEmailSender(), maxAttempts: 2);
        using var client = factory.CreateClient();
        using var registration = await client.PostAsJsonAsync(
            "/api/auth/register",
            new CreateUserRequest
            {
                Login = "outbox-user",
                DisplayName = "Outbox User",
                Email = "outbox-user@example.test",
                Password = ArcaneLinkApiFactory.Password
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(registration);

        Guid messageId;
        await using (var inspectionScope = factory.Services.CreateAsyncScope())
        {
            var db = inspectionScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var message = await db.EmailOutboxMessages.SingleAsync();
            messageId = message.Id;
            Assert.Equal(EmailOutboxKinds.Send, message.Kind);
            Assert.DoesNotContain(
                "outbox-user@example.test",
                message.ProtectedPayload,
                StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("confirm-email", message.ProtectedPayload, StringComparison.OrdinalIgnoreCase);
        }

        await ProcessOneAsync(factory);
        await MakeImmediatelyAvailableAsync(factory, messageId);
        await ProcessOneAsync(factory);

        await using var resultScope = factory.Services.CreateAsyncScope();
        var resultDb = resultScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var failed = await resultDb.EmailOutboxMessages.SingleAsync(x => x.Id == messageId);
        Assert.Equal(2, failed.AttemptCount);
        Assert.NotNull(failed.DeadLetteredAt);
        Assert.Null(failed.ProcessedAt);
        Assert.Equal(nameof(InvalidOperationException), failed.LastError);
    }

    [Fact]
    public async Task ForgotAndResend_AlwaysQueueTheSameProtectedLookupJob()
    {
        using var factory = CreateFactory(new NoOpEmailSender());
        using var client = factory.CreateClient();

        var resendUnknown = await client.PostAsJsonAsync(
            "/api/auth/email/resend",
            new ResendVerificationEmailRequest { Email = "unknown@example.test" });
        var resendKnown = await client.PostAsJsonAsync(
            "/api/auth/email/resend",
            new ResendVerificationEmailRequest { Email = "member@example.test" });
        var forgotUnknown = await client.PostAsJsonAsync(
            "/api/auth/password/forgot",
            new ForgotPasswordRequest { LoginOrEmail = "unknown@example.test" });
        var forgotKnown = await client.PostAsJsonAsync(
            "/api/auth/password/forgot",
            new ForgotPasswordRequest { LoginOrEmail = "member" });

        Assert.All(
            new[] { resendUnknown, resendKnown, forgotUnknown, forgotKnown },
            response => Assert.Equal(HttpStatusCode.Accepted, response.StatusCode));
        Assert.Equal(
            await resendUnknown.Content.ReadAsStringAsync(),
            await resendKnown.Content.ReadAsStringAsync());
        Assert.Equal(
            await forgotUnknown.Content.ReadAsStringAsync(),
            await forgotKnown.Content.ReadAsStringAsync());

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var messages = await db.EmailOutboxMessages.AsNoTracking().ToListAsync();
        Assert.Equal(2, messages.Count(x => x.Kind == EmailOutboxKinds.VerificationLookup));
        Assert.Equal(2, messages.Count(x => x.Kind == EmailOutboxKinds.PasswordResetLookup));
        Assert.All(messages, message =>
        {
            Assert.DoesNotContain("unknown", message.ProtectedPayload, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("member", message.ProtectedPayload, StringComparison.OrdinalIgnoreCase);
        });
    }

    [Fact]
    public async Task DisabledMailSender_RefusesToAcknowledgeDelivery()
    {
        var sender = new MailKitEmailSender(
            Options.Create(new EmailDeliveryOptions { Enabled = false }));

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            sender.SendAsync(
                "user@example.test",
                "subject",
                "text",
                "<p>text</p>"));

        Assert.Contains("disabled", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Registration_RollsBackWhenOutboxCannotBeCreated()
    {
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IEmailOutboxQueue>();
            services.AddScoped<IEmailOutboxQueue, ThrowingOutboxQueue>();
        });
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new CreateUserRequest
            {
                Login = "atomic-register",
                DisplayName = "Atomic Register",
                Email = "atomic-register@example.test",
                Password = ArcaneLinkApiFactory.Password
            });
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.DoesNotContain(db.Users, x => x.LoginNorm == "ATOMIC-REGISTER");
        Assert.DoesNotContain(
            db.UserAccountActionTokens,
            x => x.PendingValue == "ATOMIC-REGISTER@EXAMPLE.TEST");
    }

    [Fact]
    public async Task StaleWorker_CannotAcknowledgeMessageAfterLeaseWasReclaimed()
    {
        using var factory = CreateFactory(new NoOpEmailSender());
        using var client = factory.CreateClient();
        using var registration = await client.PostAsJsonAsync(
            "/api/auth/register",
            new CreateUserRequest
            {
                Login = "lease-fence-user",
                DisplayName = "Lease Fence User",
                Email = "lease-fence-user@example.test",
                Password = ArcaneLinkApiFactory.Password
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(registration);

        var firstLease = Guid.NewGuid();
        Guid messageId;
        await using (var setupScope = factory.Services.CreateAsyncScope())
        {
            var setupDb = setupScope.ServiceProvider.GetRequiredService<AppDbContext>();
            var message = await setupDb.EmailOutboxMessages.SingleAsync();
            messageId = message.Id;
            message.LeaseId = firstLease;
            message.LeaseExpiresAt = DateTime.UtcNow.AddSeconds(-1);
            await setupDb.SaveChangesAsync();
        }

        await using var staleScope = factory.Services.CreateAsyncScope();
        var staleDb = staleScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var staleClaim = await staleDb.EmailOutboxMessages.SingleAsync(
            message => message.Id == messageId);

        var replacementLease = Guid.NewGuid();
        await using (var reclaimScope = factory.Services.CreateAsyncScope())
        {
            var reclaimDb = reclaimScope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(
                1,
                await reclaimDb.EmailOutboxMessages
                    .Where(message => message.Id == messageId &&
                                      message.LeaseId == firstLease)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(message => message.LeaseId, replacementLease)
                        .SetProperty(
                            message => message.LeaseExpiresAt,
                            DateTime.UtcNow.AddMinutes(1))));
        }

        staleClaim.ProcessedAt = DateTime.UtcNow;
        staleClaim.LeaseId = null;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
            () => staleDb.SaveChangesAsync());
    }

    private static ArcaneLinkApiFactory CreateFactory(
        IEmailSender sender,
        int maxAttempts = 8)
    {
        return new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.RemoveAll<IOptions<EmailOutboxOptions>>();
            services.AddSingleton(sender);
            services.AddSingleton<IOptions<EmailOutboxOptions>>(
                Options.Create(new EmailOutboxOptions
                {
                    PollIntervalSeconds = 1,
                    LeaseSeconds = 30,
                    MaxAttempts = maxAttempts,
                    MaxBackoffMinutes = 1
                }));
        });
    }

    private static async Task ProcessOneAsync(ArcaneLinkApiFactory factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var processor = scope.ServiceProvider.GetRequiredService<EmailOutboxProcessor>();
        Assert.True(await processor.ProcessOneAsync());
    }

    private static async Task MakeImmediatelyAvailableAsync(
        ArcaneLinkApiFactory factory,
        Guid messageId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var message = await db.EmailOutboxMessages.SingleAsync(x => x.Id == messageId);
        message.AvailableAt = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();
    }

    private sealed class ThrowingEmailSender : IEmailSender
    {
        public Task SendAsync(
            string recipient,
            string subject,
            string textBody,
            string htmlBody,
            CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("SMTP unavailable for test.");
    }

    private sealed class NoOpEmailSender : IEmailSender
    {
        public Task SendAsync(
            string recipient,
            string subject,
            string textBody,
            string htmlBody,
            CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class ThrowingOutboxQueue : IEmailOutboxQueue
    {
        public void EnqueueEmail(OutboxEmail email) =>
            throw new InvalidOperationException("Outbox write failed for test.");

        public void EnqueueLookup(string kind, string lookup) =>
            throw new InvalidOperationException("Outbox write failed for test.");
    }
}
