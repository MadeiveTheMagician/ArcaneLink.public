using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.DTOs.Login;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Services.Email;
using ArcaneLink.Services.Email.Abstractions;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Auth;

public sealed class AccountLifecycleIntegrationTests
{
    [Fact]
    public async Task Registration_RequiresSingleUseEmailConfirmationBeforeLogin()
    {
        var email = new RecordingEmailSender();
        using var factory = CreateFactory(email);
        using var client = factory.CreateClient();

        var registration = await client.PostAsJsonAsync(
            "/api/auth/register",
            new CreateUserRequest
            {
                Login = "pending-user",
                DisplayName = "Pending User",
                Email = "pending@example.test",
                Password = ArcaneLinkApiFactory.Password
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(registration);
        var registeredUser = await registration.Content.ReadFromJsonAsync<JsonObject>();
        Assert.True(registeredUser?["requiresEmailConfirmation"]?.GetValue<bool>());

        var wrongPasswordLogin = await LoginAsync(
            client,
            "pending-user",
            "WrongPassword123!");
        Assert.Equal(HttpStatusCode.Unauthorized, wrongPasswordLogin.StatusCode);

        var blockedLogin = await LoginAsync(
            client,
            "pending-user",
            ArcaneLinkApiFactory.Password);
        Assert.Equal(HttpStatusCode.Forbidden, blockedLogin.StatusCode);
        var blockedBody = await blockedLogin.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal(
            "email_not_confirmed",
            blockedBody?["errors"]?[0]?["code"]?.GetValue<string>());

        await DispatchAllEmailsAsync(factory);
        var confirmationToken = email.GetLatestToken("confirm-email");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.DoesNotContain(
                db.UserAccountActionTokens,
                x => x.TokenHash == confirmationToken);
        }

        var confirmation = await client.PostAsJsonAsync(
            "/api/auth/email/confirm",
            new EmailTokenRequest { Token = confirmationToken });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(confirmation);

        var replay = await client.PostAsJsonAsync(
            "/api/auth/email/confirm",
            new EmailTokenRequest { Token = confirmationToken });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        var login = await LoginAsync(
            client,
            "pending-user",
            ArcaneLinkApiFactory.Password);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(login);

        using var verificationScope = factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider
            .GetRequiredService<AppDbContext>();
        var user = verificationDb.Users.Single(x => x.LoginNorm == "PENDING-USER");
        Assert.Equal(UserStatusIds.Active, user.StatusId);
        Assert.NotNull(user.EmailConfirmedAt);
    }

    [Fact]
    public async Task ForgotPassword_IsNonEnumerating_AndResetRevokesSessions()
    {
        var email = new RecordingEmailSender();
        using var factory = CreateFactory(email);
        using var client = factory.CreateClient();

        var login = await LoginAsync(
            client,
            "member",
            ArcaneLinkApiFactory.Password);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(login);
        var loginBody = await login.Content.ReadFromJsonAsync<JsonObject>();
        var refreshToken = loginBody?["refreshToken"]?.GetValue<string>();
        Assert.False(string.IsNullOrWhiteSpace(refreshToken));

        var unknown = await client.PostAsJsonAsync(
            "/api/auth/password/forgot",
            new ForgotPasswordRequest { LoginOrEmail = "unknown@example.test" });
        var known = await client.PostAsJsonAsync(
            "/api/auth/password/forgot",
            new ForgotPasswordRequest { LoginOrEmail = "member" });
        Assert.Equal(HttpStatusCode.Accepted, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode);
        Assert.Equal(
            await unknown.Content.ReadAsStringAsync(),
            await known.Content.ReadAsStringAsync());
        await DispatchAllEmailsAsync(factory);

        const string newPassword = "NewTestPass456!";
        var reset = await client.PostAsJsonAsync(
            "/api/auth/password/reset",
            new ResetPasswordRequest
            {
                Token = email.GetLatestToken("reset-password"),
                NewPassword = newPassword
            });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        var refresh = await client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = refreshToken! });
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await LoginAsync(client, "member", ArcaneLinkApiFactory.Password)).StatusCode);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            await LoginAsync(client, "member", newPassword));
    }

    [Fact]
    public async Task EmailChange_KeepsOldEmailUntilConfirmation_ThenRequiresReauthentication()
    {
        var email = new RecordingEmailSender();
        using var factory = CreateFactory(email);
        using var client = factory.CreateClient();

        var login = await LoginAsync(client, "owner", ArcaneLinkApiFactory.Password);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(login);
        var loginBody = await login.Content.ReadFromJsonAsync<JsonObject>();
        client.AuthorizeWith(loginBody!["accessToken"]!.GetValue<string>());

        var request = await client.PostAsJsonAsync(
            "/api/auth/account/email/change",
            new ChangeEmailRequest
            {
                NewEmail = "owner-new@example.test",
                CurrentPassword = ArcaneLinkApiFactory.Password
            });
        Assert.Equal(HttpStatusCode.Accepted, request.StatusCode);

        using (var beforeScope = factory.Services.CreateScope())
        {
            var beforeDb = beforeScope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(
                "owner@example.test",
                beforeDb.Users.Single(x => x.Id == ArcaneLinkApiFactory.OwnerUserId).Email);
        }

        var pendingReset = await client.PostAsJsonAsync(
            "/api/auth/password/forgot",
            new ForgotPasswordRequest { LoginOrEmail = "owner" });
        Assert.Equal(HttpStatusCode.Accepted, pendingReset.StatusCode);
        await DispatchAllEmailsAsync(factory);
        var oldAddressMessageCount = email.CountForRecipient("owner@example.test");
        var confirm = await client.PostAsJsonAsync(
            "/api/auth/email/confirm",
            new EmailTokenRequest { Token = email.GetLatestToken("confirm-email") });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(confirm);
        var confirmBody = await confirm.Content.ReadFromJsonAsync<ConfirmEmailResponse>();
        Assert.True(confirmBody?.EmailChanged);
        Assert.True(confirmBody?.RequiresReauthentication);

        await using (var afterConfirmationScope = factory.Services.CreateAsyncScope())
        {
            var afterConfirmationDb = afterConfirmationScope.ServiceProvider
                .GetRequiredService<AppDbContext>();
            Assert.DoesNotContain(
                afterConfirmationDb.UserAccountActionTokens,
                token => token.UserId == ArcaneLinkApiFactory.OwnerUserId &&
                         token.ConsumedAt == null);
            Assert.Contains(
                afterConfirmationDb.EmailOutboxMessages,
                message => message.ProcessedAt == null &&
                           message.DeadLetteredAt == null);
        }

        await DispatchAllEmailsAsync(factory);
        Assert.Equal(
            oldAddressMessageCount + 1,
            email.CountForRecipient("owner@example.test"));

        client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await LoginAsync(client, "owner@example.test", ArcaneLinkApiFactory.Password)).StatusCode);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            await LoginAsync(client, "owner-new@example.test", ArcaneLinkApiFactory.Password));
    }

    [Fact]
    public async Task LoginAndPasswordChanges_RequireCurrentPasswordAndRevokeSessions()
    {
        var email = new RecordingEmailSender();
        using var factory = CreateFactory(email);
        using var client = factory.CreateClient();

        var login = await LoginAsync(client, "outsider", ArcaneLinkApiFactory.Password);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(login);
        var loginBody = await login.Content.ReadFromJsonAsync<JsonObject>();
        client.AuthorizeWith(loginBody!["accessToken"]!.GetValue<string>());

        var wrongPassword = await client.PutAsJsonAsync(
            "/api/auth/account/login",
            new ChangeLoginRequest
            {
                NewLogin = "renamed-outsider",
                CurrentPassword = "WrongPassword123!"
            });
        Assert.Equal(HttpStatusCode.BadRequest, wrongPassword.StatusCode);

        var loginChange = await client.PutAsJsonAsync(
            "/api/auth/account/login",
            new ChangeLoginRequest
            {
                NewLogin = "renamed-outsider",
                CurrentPassword = ArcaneLinkApiFactory.Password
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(loginChange);
        var loginChangeBody = await loginChange.Content
            .ReadFromJsonAsync<AccountChangeResponse>();
        Assert.True(loginChangeBody?.RequiresReauthentication);

        client.DefaultRequestHeaders.Authorization = null;
        var renamedLogin = await LoginAsync(
            client,
            "renamed-outsider",
            ArcaneLinkApiFactory.Password);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(renamedLogin);
        var renamedBody = await renamedLogin.Content.ReadFromJsonAsync<JsonObject>();
        client.AuthorizeWith(renamedBody!["accessToken"]!.GetValue<string>());

        var pendingReset = await client.PostAsJsonAsync(
            "/api/auth/password/forgot",
            new ForgotPasswordRequest { LoginOrEmail = "renamed-outsider" });
        Assert.Equal(HttpStatusCode.Accepted, pendingReset.StatusCode);
        await DispatchAllEmailsAsync(factory);
        await using (var beforePasswordScope = factory.Services.CreateAsyncScope())
        {
            var beforePasswordDb = beforePasswordScope.ServiceProvider
                .GetRequiredService<AppDbContext>();
            Assert.Contains(
                beforePasswordDb.UserAccountActionTokens,
                token => token.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
                         token.ConsumedAt == null);
        }

        const string newPassword = "ChangedPass789!";
        var passwordChange = await client.PostAsJsonAsync(
            "/api/auth/account/password/change",
            new ChangePasswordRequest
            {
                CurrentPassword = ArcaneLinkApiFactory.Password,
                NewPassword = newPassword
            });
        Assert.Equal(HttpStatusCode.NoContent, passwordChange.StatusCode);

        await using (var tokenScope = factory.Services.CreateAsyncScope())
        {
            var tokenDb = tokenScope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.DoesNotContain(
                tokenDb.UserAccountActionTokens,
                token => token.UserId == ArcaneLinkApiFactory.OutsiderUserId &&
                         token.ConsumedAt == null);
        }

        client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await LoginAsync(client, "renamed-outsider", ArcaneLinkApiFactory.Password)).StatusCode);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            await LoginAsync(client, "renamed-outsider", newPassword));
    }

    [Fact]
    public async Task AccountChanges_RejectValuesThatBecomeInvalidAfterTrim()
    {
        var email = new RecordingEmailSender();
        using var factory = CreateFactory(email);
        using var client = factory.CreateClient();
        var login = await LoginAsync(client, "owner", ArcaneLinkApiFactory.Password);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(login);
        var loginBody = await login.Content.ReadFromJsonAsync<JsonObject>();
        client.AuthorizeWith(loginBody!["accessToken"]!.GetValue<string>());

        var emptyLogin = await client.PutAsJsonAsync(
            "/api/auth/account/login",
            new ChangeLoginRequest
            {
                NewLogin = "   ",
                CurrentPassword = ArcaneLinkApiFactory.Password
            });
        Assert.Equal(HttpStatusCode.BadRequest, emptyLogin.StatusCode);

        var malformedEmail = await client.PostAsJsonAsync(
            "/api/auth/account/email/change",
            new ChangeEmailRequest
            {
                NewEmail = " user@example.test extra ",
                CurrentPassword = ArcaneLinkApiFactory.Password
            });
        Assert.Equal(HttpStatusCode.BadRequest, malformedEmail.StatusCode);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var owner = db.Users.Single(x => x.Id == ArcaneLinkApiFactory.OwnerUserId);
        Assert.Equal("owner", owner.Login);
        Assert.Equal("owner@example.test", owner.Email);
    }

    private static ArcaneLinkApiFactory CreateFactory(RecordingEmailSender emailSender)
    {
        return new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(emailSender);
        });
    }

    private static Task<HttpResponseMessage> LoginAsync(
        HttpClient client,
        string loginOrEmail,
        string password)
    {
        return client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest
            {
                LoginOrEmail = loginOrEmail,
                Password = password,
                DeviceName = "account-lifecycle-test"
            });
    }

    private static async Task DispatchAllEmailsAsync(ArcaneLinkApiFactory factory)
    {
        for (var index = 0; index < 20; index++)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var processor = scope.ServiceProvider.GetRequiredService<EmailOutboxProcessor>();
            if (!await processor.ProcessOneAsync())
            {
                return;
            }
        }

        throw new InvalidOperationException("Email outbox did not drain within the test limit.");
    }

    private sealed class RecordingEmailSender : IEmailSender
    {
        private readonly List<SentEmail> _messages = [];

        public Task SendAsync(
            string recipient,
            string subject,
            string textBody,
            string htmlBody,
            CancellationToken cancellationToken = default)
        {
            this._messages.Add(new SentEmail(recipient, subject, textBody));
            return Task.CompletedTask;
        }

        public string GetLatestToken(string expectedAction)
        {
            var message = this._messages.Last(x => x.TextBody.Contains(
                $"action={expectedAction}",
                StringComparison.Ordinal));
            var link = message.TextBody.Split(
                    [' ', '\r', '\n', '\t'],
                    StringSplitOptions.RemoveEmptyEntries)
                .Single(x =>
                    x.StartsWith("https://", StringComparison.Ordinal) &&
                    x.Contains($"#action={expectedAction}", StringComparison.Ordinal));
            var query = new Uri(link).Fragment.TrimStart('#')
                .Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Split('=', 2))
                .ToDictionary(
                    x => Uri.UnescapeDataString(x[0]),
                    x => Uri.UnescapeDataString(x[1]));
            Assert.Equal(expectedAction, query["action"]);
            return query["token"];
        }

        public int CountForRecipient(string recipient) =>
            this._messages.Count(message => string.Equals(
                message.Recipient,
                recipient,
                StringComparison.OrdinalIgnoreCase));

        private sealed record SentEmail(
            string Recipient,
            string Subject,
            string TextBody);
    }
}
