using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.Exceptions.AuthExceptions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.Email;
using ArcaneLink.Services.Email.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.RequestInfo.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Services.Validators;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Auth;

public sealed class AccountLifecycleService : IAccountLifecycleService
{
    private const int TokenByteLength = 48;

    private readonly AppDbContext _db;
    private readonly IUserPasswordService _passwordService;
    private readonly PasswordValidator _passwordValidator;
    private readonly IEmailOutboxQueue _emailOutbox;
    private readonly IEmailTemplateRenderer _emailTemplates;
    private readonly EmailDeliveryOptions _options;
    private readonly ILogger<AccountLifecycleService> _logger;
    private readonly IRequestInfoService _requestInfoService;
    private readonly IRealtimeNotificationService _realtime;

    public AccountLifecycleService(
        AppDbContext db,
        IUserPasswordService passwordService,
        PasswordValidator passwordValidator,
        IEmailOutboxQueue emailOutbox,
        IEmailTemplateRenderer emailTemplates,
        IOptions<EmailDeliveryOptions> options,
        ILogger<AccountLifecycleService> logger,
        IRequestInfoService requestInfoService,
        IRealtimeNotificationService realtime)
    {
        this._db = db;
        this._passwordService = passwordService;
        this._passwordValidator = passwordValidator;
        this._emailOutbox = emailOutbox;
        this._emailTemplates = emailTemplates;
        this._options = options.Value;
        this._logger = logger;
        this._requestInfoService = requestInfoService;
        this._realtime = realtime;
    }

    public async Task QueueRegistrationVerificationAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await this._db.Users.FirstOrDefaultAsync(
            x => x.Id == userId &&
                 x.DeletedAt == null &&
                 x.StatusId == UserStatusIds.PendingEmailVerification,
            cancellationToken);
        if (user is null)
        {
            return;
        }

        var rawToken = await this.CreateTokenAsync(
            user.Id,
            AccountActionTokenPurposes.EmailVerification,
            pendingValue: user.EmailNorm,
            DateTime.UtcNow.AddHours(this._options.EmailVerificationLifetimeHours),
            cancellationToken);
        this._emailOutbox.EnqueueEmail(this.CreateVerificationEmail(user.Email, rawToken));
        await this._db.SaveChangesAsync(cancellationToken);
    }

    public async Task QueueVerificationResendAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        // Eligibility is deliberately resolved by the worker. Existing and
        // non-existing accounts therefore follow the same request path.
        this._emailOutbox.EnqueueLookup(
            EmailOutboxKinds.VerificationLookup,
            Normalize(email));
        await this._db.SaveChangesAsync(cancellationToken);
    }

    public async Task<ConfirmEmailResponse> ConfirmEmailAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        var actionToken = await this.FindValidTokenAsync(
            token,
            [AccountActionTokenPurposes.EmailVerification, AccountActionTokenPurposes.EmailChange],
            cancellationToken);
        var now = DateTime.UtcNow;

        if (actionToken.Purpose == AccountActionTokenPurposes.EmailVerification)
        {
            if (actionToken.User.StatusId != UserStatusIds.PendingEmailVerification ||
                actionToken.PendingValue != actionToken.User.EmailNorm)
            {
                throw new InvalidAccountActionTokenException();
            }

            actionToken.User.EmailConfirmedAt = now;
            actionToken.User.StatusId = UserStatusIds.Active;
            actionToken.User.UpdatedAt = now;
            actionToken.ConsumedAt = now;
            await this.SaveConsumedTokenAsync(cancellationToken);
            return new ConfirmEmailResponse(true, false, false);
        }

        var newEmail = actionToken.PendingValue?.Trim();
        if (string.IsNullOrWhiteSpace(newEmail))
        {
            throw new InvalidAccountActionTokenException();
        }

        var newEmailNorm = Normalize(newEmail);
        var isOccupied = await this._db.Users.AnyAsync(
            x => x.Id != actionToken.UserId && x.EmailNorm == newEmailNorm,
            cancellationToken);
        if (isOccupied)
        {
            throw new EmailAlreadyExistsException();
        }

        var oldEmail = actionToken.User.Email;
        actionToken.User.Email = newEmail;
        actionToken.User.EmailNorm = newEmailNorm;
        actionToken.User.EmailConfirmedAt = now;
        actionToken.User.UpdatedAt = now;
        actionToken.ConsumedAt = now;
        this._emailOutbox.EnqueueEmail(this.CreateEmailChangedSecurityNotice(oldEmail));
        await this.CommitAccountMutationAndRevokeSessionsAsync(
            actionToken.UserId,
            tokenBackedMutation: true,
            invalidateActionTokens: true,
            cancellationToken);

        return new ConfirmEmailResponse(true, true, true);
    }

    public async Task QueuePasswordResetAsync(
        string loginOrEmail,
        CancellationToken cancellationToken = default)
    {
        this._emailOutbox.EnqueueLookup(
            EmailOutboxKinds.PasswordResetLookup,
            Normalize(loginOrEmail));
        await this._db.SaveChangesAsync(cancellationToken);
    }

    public async Task ResetPasswordAsync(
        string token,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        await this.ValidateNewPasswordAsync(newPassword);
        var actionToken = await this.FindValidTokenAsync(
            token,
            [AccountActionTokenPurposes.PasswordReset],
            cancellationToken);
        var now = DateTime.UtcNow;
        actionToken.User.PasswordHash = this._passwordService.HashPassword(
            actionToken.User,
            newPassword);
        actionToken.User.PasswordChangedAt = now;
        actionToken.User.UpdatedAt = now;
        actionToken.ConsumedAt = now;
        await this.CommitAccountMutationAndRevokeSessionsAsync(
            actionToken.UserId,
            tokenBackedMutation: true,
            invalidateActionTokens: true,
            cancellationToken);
    }

    public async Task<AccountChangeResponse> ChangeLoginAsync(
        Guid userId,
        ChangeLoginRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await this.GetActiveUserAsync(userId, cancellationToken);
        this.EnsureCurrentPassword(user, request.CurrentPassword);
        var newLogin = request.NewLogin.Trim();
        if (newLogin.Length is < 3 or > 50)
        {
            throw new InvalidUserRegistrationDataException(
                "Login must contain between 3 and 50 non-whitespace characters.");
        }
        var newLoginNorm = Normalize(newLogin);
        if (await this._db.Users.AnyAsync(
                x => x.Id != userId && x.LoginNorm == newLoginNorm,
                cancellationToken))
        {
            throw new LoginAlreadyExistsException();
        }

        user.Login = newLogin;
        user.LoginNorm = newLoginNorm;
        user.UpdatedAt = DateTime.UtcNow;
        await this.CommitAccountMutationAndRevokeSessionsAsync(
            userId,
            tokenBackedMutation: false,
            invalidateActionTokens: false,
            cancellationToken);
        return new AccountChangeResponse(user.Login, user.Email, true);
    }

    public async Task QueueEmailChangeAsync(
        Guid userId,
        ChangeEmailRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await this.GetActiveUserAsync(userId, cancellationToken);
        this.EnsureCurrentPassword(user, request.CurrentPassword);
        var newEmail = request.NewEmail.Trim();
        if (string.IsNullOrWhiteSpace(newEmail) ||
            newEmail.Length > 254 ||
            !System.Net.Mail.MailAddress.TryCreate(newEmail, out var parsedEmail) ||
            !string.Equals(parsedEmail.Address, newEmail, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidUserRegistrationDataException(
                "Email address is invalid.");
        }
        var newEmailNorm = Normalize(newEmail);
        if (await this._db.Users.AnyAsync(
                x => x.Id != userId && x.EmailNorm == newEmailNorm,
                cancellationToken))
        {
            throw new EmailAlreadyExistsException();
        }

        await using var transaction = await this._db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var rawToken = await this.CreateTokenAsync(
            user.Id,
            AccountActionTokenPurposes.EmailChange,
            newEmail,
            DateTime.UtcNow.AddHours(this._options.EmailChangeLifetimeHours),
            cancellationToken);
        this._emailOutbox.EnqueueEmail(this.CreateEmailChangeEmail(newEmail, rawToken));
        await this._db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task ChangePasswordAsync(
        Guid userId,
        ChangePasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await this.GetActiveUserAsync(userId, cancellationToken);
        this.EnsureCurrentPassword(user, request.CurrentPassword);
        await this.ValidateNewPasswordAsync(request.NewPassword);
        var now = DateTime.UtcNow;
        user.PasswordHash = this._passwordService.HashPassword(user, request.NewPassword);
        user.PasswordChangedAt = now;
        user.UpdatedAt = now;
        await this.CommitAccountMutationAndRevokeSessionsAsync(
            userId,
            tokenBackedMutation: false,
            invalidateActionTokens: true,
            cancellationToken);
    }

    private async Task<string> CreateTokenAsync(
        Guid userId,
        string purpose,
        string? pendingValue,
        DateTime expiresAt,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var previousTokens = await this._db.UserAccountActionTokens
            .Where(x => x.UserId == userId &&
                        x.Purpose == purpose &&
                        x.ConsumedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var previousToken in previousTokens)
        {
            previousToken.ConsumedAt = now;
        }

        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(TokenByteLength))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        this._db.UserAccountActionTokens.Add(new UserAccountActionToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Purpose = purpose,
            TokenHash = HashToken(rawToken),
            PendingValue = pendingValue,
            CreatedAt = now,
            ExpiresAt = expiresAt
        });
        return rawToken;
    }

    private async Task InvalidateActiveAccountTokensAsync(
        Guid userId,
        DateTime consumedAt,
        CancellationToken cancellationToken)
    {
        var activeTokens = await this._db.UserAccountActionTokens
            .Where(x => x.UserId == userId && x.ConsumedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var activeToken in activeTokens)
        {
            activeToken.ConsumedAt = consumedAt;
        }
    }

    private async Task<UserAccountActionToken> FindValidTokenAsync(
        string rawToken,
        IReadOnlyCollection<string> purposes,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawToken))
        {
            throw new InvalidAccountActionTokenException();
        }

        var tokenHash = HashToken(rawToken.Trim());
        var actionToken = await this._db.UserAccountActionTokens
            .Include(x => x.User)
            .FirstOrDefaultAsync(
                x => x.TokenHash == tokenHash && purposes.Contains(x.Purpose),
                cancellationToken);
        if (actionToken is null ||
            actionToken.ConsumedAt != null ||
            actionToken.ExpiresAt <= DateTime.UtcNow ||
            actionToken.User.DeletedAt != null)
        {
            throw new InvalidAccountActionTokenException();
        }

        return actionToken;
    }

    private async Task SaveConsumedTokenAsync(CancellationToken cancellationToken)
    {
        try
        {
            await this._db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new InvalidAccountActionTokenException();
        }
    }

    private async Task CommitAccountMutationAndRevokeSessionsAsync(
        Guid userId,
        bool tokenBackedMutation,
        bool invalidateActionTokens,
        CancellationToken cancellationToken)
    {
        await using var transaction = await this._db.Database
            .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var now = DateTime.UtcNow;
        if (invalidateActionTokens)
        {
            await this.InvalidateActiveAccountTokensAsync(userId, now, cancellationToken);
        }

        var revokedByIp = this._requestInfoService.GetClientIpAddress();
        var tokens = await this._db.UserRefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.RevokedAt = now;
            token.RevokedByIp = revokedByIp;
        }

        var sessions = await this._db.UserDeviceSessions
            .Where(x => x.UserId == userId && x.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.RevokedAt = now;
            session.LastUsedAt = now;
        }

        try
        {
            await this._db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException) when (tokenBackedMutation)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new InvalidAccountActionTokenException();
        }

        // Realtime delivery is deliberately outside the transaction: a
        // transient SignalR failure must never roll back committed security
        // state, and clients can reconcile from the sessions endpoint.
        try
        {
            await this._realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.UserSessionsChanged,
                new { all = true },
                cancellationToken);
            await this._realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.CurrentSessionRevoked,
                new { all = true },
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            this._logger.LogWarning(
                exception,
                "Account security state committed, but session revocation realtime delivery failed. UserId={UserId}",
                userId);
        }
    }

    public async Task<OutboxEmail?> PrepareDeferredEmailAsync(
        string kind,
        string lookup,
        CancellationToken cancellationToken = default)
    {
        var normalized = Normalize(lookup);
        if (kind == EmailOutboxKinds.VerificationLookup)
        {
            var user = await this._db.Users.FirstOrDefaultAsync(
                x => x.EmailNorm == normalized &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.PendingEmailVerification,
                cancellationToken);
            if (user is null)
            {
                return null;
            }

            var token = await this.CreateTokenAsync(
                user.Id,
                AccountActionTokenPurposes.EmailVerification,
                user.EmailNorm,
                DateTime.UtcNow.AddHours(this._options.EmailVerificationLifetimeHours),
                cancellationToken);
            return this.CreateVerificationEmail(user.Email, token);
        }

        if (kind == EmailOutboxKinds.PasswordResetLookup)
        {
            var user = await this._db.Users.FirstOrDefaultAsync(
                x => (x.LoginNorm == normalized || x.EmailNorm == normalized) &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active &&
                     x.EmailConfirmedAt != null,
                cancellationToken);
            if (user is null)
            {
                return null;
            }

            var token = await this.CreateTokenAsync(
                user.Id,
                AccountActionTokenPurposes.PasswordReset,
                pendingValue: null,
                DateTime.UtcNow.AddMinutes(this._options.PasswordResetLifetimeMinutes),
                cancellationToken);
            return this.CreatePasswordResetEmail(user.Email, token);
        }

        throw new InvalidOperationException("Unsupported deferred email kind.");
    }

    private OutboxEmail CreateVerificationEmail(string email, string token)
    {
        return this.CreateTemplatedEmail(
            email,
            EmailTemplateNames.EmailVerification,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["link"] = this.BuildLink("confirm-email", token),
                ["lifetime_hours"] = this._options.EmailVerificationLifetimeHours
                    .ToString(CultureInfo.InvariantCulture)
            });
    }

    private OutboxEmail CreatePasswordResetEmail(string email, string token)
    {
        return this.CreateTemplatedEmail(
            email,
            EmailTemplateNames.PasswordReset,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["link"] = this.BuildLink("reset-password", token),
                ["lifetime_minutes"] = this._options.PasswordResetLifetimeMinutes
                    .ToString(CultureInfo.InvariantCulture)
            });
    }

    private OutboxEmail CreateEmailChangeEmail(string email, string token)
    {
        return this.CreateTemplatedEmail(
            email,
            EmailTemplateNames.EmailChange,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["link"] = this.BuildLink("confirm-email", token),
                ["lifetime_hours"] = this._options.EmailChangeLifetimeHours
                    .ToString(CultureInfo.InvariantCulture)
            });
    }

    private OutboxEmail CreateEmailChangedSecurityNotice(string oldEmail) =>
        this.CreateTemplatedEmail(
            oldEmail,
            EmailTemplateNames.EmailChangedSecurityNotice);

    private OutboxEmail CreateTemplatedEmail(
        string recipient,
        string templateName,
        IReadOnlyDictionary<string, string>? variables = null)
    {
        var template = this._emailTemplates.Render(templateName, variables);
        return new OutboxEmail(
            recipient,
            template.Subject,
            template.TextBody,
            template.HtmlBody);
    }

    private string BuildLink(string action, string token) =>
        $"{this._options.PublicOrigin.TrimEnd('/')}/#action={Uri.EscapeDataString(action)}&token={Uri.EscapeDataString(token)}";

    private async Task<DataBase.Models.UsersModels.User> GetActiveUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await this._db.Users.FirstOrDefaultAsync(
                   x => x.Id == userId &&
                        x.DeletedAt == null &&
                        x.StatusId == UserStatusIds.Active &&
                        x.EmailConfirmedAt != null,
                   cancellationToken)
               ?? throw new InvalidOperationException("Authenticated user is unavailable.");
    }

    private void EnsureCurrentPassword(
        DataBase.Models.UsersModels.User user,
        string currentPassword)
    {
        if (this._passwordService.VerifyPassword(user, user.PasswordHash, currentPassword) ==
            PasswordVerificationResult.Failed)
        {
            throw new InvalidCurrentPasswordException();
        }
    }

    private async Task ValidateNewPasswordAsync(string password)
    {
        var validation = await this._passwordValidator.ValidateDetailedAsync(password);
        if (!validation.IsValid)
        {
            throw new InvalidUserRegistrationDataException(
                "Password is invalid.",
                validation.Errors);
        }
    }

    private static string Normalize(string value) => value.Trim().ToUpperInvariant();

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
