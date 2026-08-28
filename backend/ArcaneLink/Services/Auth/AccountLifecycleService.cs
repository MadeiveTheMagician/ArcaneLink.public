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
        _db = db;
        _passwordService = passwordService;
        _passwordValidator = passwordValidator;
        _emailOutbox = emailOutbox;
        _emailTemplates = emailTemplates;
        _options = options.Value;
        _logger = logger;
        _requestInfoService = requestInfoService;
        _realtime = realtime;
    }

    public async Task QueueRegistrationVerificationAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(
            x => x.Id == userId &&
                 x.DeletedAt == null &&
                 x.StatusId == UserStatusIds.PendingEmailVerification,
            cancellationToken);
        if (user is null)
        {
            return;
        }

        var rawToken = await CreateTokenAsync(
            user.Id,
            AccountActionTokenPurposes.EmailVerification,
            pendingValue: user.EmailNorm,
            DateTime.UtcNow.AddHours(_options.EmailVerificationLifetimeHours),
            cancellationToken);
        _emailOutbox.EnqueueEmail(CreateVerificationEmail(user.Email, rawToken));
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task QueueVerificationResendAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        // Eligibility is deliberately resolved by the worker. Existing and
        // non-existing accounts therefore follow the same request path.
        _emailOutbox.EnqueueLookup(
            EmailOutboxKinds.VerificationLookup,
            Normalize(email));
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<ConfirmEmailResponse> ConfirmEmailAsync(
        string token,
        CancellationToken cancellationToken = default)
    {
        var actionToken = await FindValidTokenAsync(
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
            await SaveConsumedTokenAsync(cancellationToken);
            return new ConfirmEmailResponse(true, false, false);
        }

        var newEmail = actionToken.PendingValue?.Trim();
        if (string.IsNullOrWhiteSpace(newEmail))
        {
            throw new InvalidAccountActionTokenException();
        }

        var newEmailNorm = Normalize(newEmail);
        var isOccupied = await _db.Users.AnyAsync(
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
        _emailOutbox.EnqueueEmail(CreateEmailChangedSecurityNotice(oldEmail));
        await CommitAccountMutationAndRevokeSessionsAsync(
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
        _emailOutbox.EnqueueLookup(
            EmailOutboxKinds.PasswordResetLookup,
            Normalize(loginOrEmail));
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task ResetPasswordAsync(
        string token,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        await ValidateNewPasswordAsync(newPassword);
        var actionToken = await FindValidTokenAsync(
            token,
            [AccountActionTokenPurposes.PasswordReset],
            cancellationToken);
        var now = DateTime.UtcNow;
        actionToken.User.PasswordHash = _passwordService.HashPassword(
            actionToken.User,
            newPassword);
        actionToken.User.PasswordChangedAt = now;
        actionToken.User.UpdatedAt = now;
        actionToken.ConsumedAt = now;
        await CommitAccountMutationAndRevokeSessionsAsync(
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
        var user = await GetActiveUserAsync(userId, cancellationToken);
        EnsureCurrentPassword(user, request.CurrentPassword);
        var newLogin = request.NewLogin.Trim();
        if (newLogin.Length is < 3 or > 50)
        {
            throw new InvalidUserRegistrationDataException(
                "Login must contain between 3 and 50 non-whitespace characters.");
        }
        var newLoginNorm = Normalize(newLogin);
        if (await _db.Users.AnyAsync(
                x => x.Id != userId && x.LoginNorm == newLoginNorm,
                cancellationToken))
        {
            throw new LoginAlreadyExistsException();
        }

        user.Login = newLogin;
        user.LoginNorm = newLoginNorm;
        user.UpdatedAt = DateTime.UtcNow;
        await CommitAccountMutationAndRevokeSessionsAsync(
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
        var user = await GetActiveUserAsync(userId, cancellationToken);
        EnsureCurrentPassword(user, request.CurrentPassword);
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
        if (await _db.Users.AnyAsync(
                x => x.Id != userId && x.EmailNorm == newEmailNorm,
                cancellationToken))
        {
            throw new EmailAlreadyExistsException();
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);
        var rawToken = await CreateTokenAsync(
            user.Id,
            AccountActionTokenPurposes.EmailChange,
            newEmail,
            DateTime.UtcNow.AddHours(_options.EmailChangeLifetimeHours),
            cancellationToken);
        _emailOutbox.EnqueueEmail(CreateEmailChangeEmail(newEmail, rawToken));
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task ChangePasswordAsync(
        Guid userId,
        ChangePasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await GetActiveUserAsync(userId, cancellationToken);
        EnsureCurrentPassword(user, request.CurrentPassword);
        await ValidateNewPasswordAsync(request.NewPassword);
        var now = DateTime.UtcNow;
        user.PasswordHash = _passwordService.HashPassword(user, request.NewPassword);
        user.PasswordChangedAt = now;
        user.UpdatedAt = now;
        await CommitAccountMutationAndRevokeSessionsAsync(
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
        var previousTokens = await _db.UserAccountActionTokens
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
        _db.UserAccountActionTokens.Add(new UserAccountActionToken
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
        var activeTokens = await _db.UserAccountActionTokens
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
        var actionToken = await _db.UserAccountActionTokens
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
            await _db.SaveChangesAsync(cancellationToken);
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
        await using var transaction = await _db.Database
            .BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var now = DateTime.UtcNow;
        if (invalidateActionTokens)
        {
            await InvalidateActiveAccountTokensAsync(userId, now, cancellationToken);
        }

        var revokedByIp = _requestInfoService.GetClientIpAddress();
        var tokens = await _db.UserRefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.RevokedAt = now;
            token.RevokedByIp = revokedByIp;
        }

        var sessions = await _db.UserDeviceSessions
            .Where(x => x.UserId == userId && x.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.RevokedAt = now;
            session.LastUsedAt = now;
        }

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
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
            await _realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.UserSessionsChanged,
                new { all = true },
                cancellationToken);
            await _realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.CurrentSessionRevoked,
                new { all = true },
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(
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
            var user = await _db.Users.FirstOrDefaultAsync(
                x => x.EmailNorm == normalized &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.PendingEmailVerification,
                cancellationToken);
            if (user is null)
            {
                return null;
            }

            var token = await CreateTokenAsync(
                user.Id,
                AccountActionTokenPurposes.EmailVerification,
                user.EmailNorm,
                DateTime.UtcNow.AddHours(_options.EmailVerificationLifetimeHours),
                cancellationToken);
            return CreateVerificationEmail(user.Email, token);
        }

        if (kind == EmailOutboxKinds.PasswordResetLookup)
        {
            var user = await _db.Users.FirstOrDefaultAsync(
                x => (x.LoginNorm == normalized || x.EmailNorm == normalized) &&
                     x.DeletedAt == null &&
                     x.StatusId == UserStatusIds.Active &&
                     x.EmailConfirmedAt != null,
                cancellationToken);
            if (user is null)
            {
                return null;
            }

            var token = await CreateTokenAsync(
                user.Id,
                AccountActionTokenPurposes.PasswordReset,
                pendingValue: null,
                DateTime.UtcNow.AddMinutes(_options.PasswordResetLifetimeMinutes),
                cancellationToken);
            return CreatePasswordResetEmail(user.Email, token);
        }

        throw new InvalidOperationException("Unsupported deferred email kind.");
    }

    private OutboxEmail CreateVerificationEmail(string email, string token)
    {
        return CreateTemplatedEmail(
            email,
            EmailTemplateNames.EmailVerification,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["link"] = BuildLink("confirm-email", token),
                ["lifetime_hours"] = _options.EmailVerificationLifetimeHours
                    .ToString(CultureInfo.InvariantCulture)
            });
    }

    private OutboxEmail CreatePasswordResetEmail(string email, string token)
    {
        return CreateTemplatedEmail(
            email,
            EmailTemplateNames.PasswordReset,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["link"] = BuildLink("reset-password", token),
                ["lifetime_minutes"] = _options.PasswordResetLifetimeMinutes
                    .ToString(CultureInfo.InvariantCulture)
            });
    }

    private OutboxEmail CreateEmailChangeEmail(string email, string token)
    {
        return CreateTemplatedEmail(
            email,
            EmailTemplateNames.EmailChange,
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["link"] = BuildLink("confirm-email", token),
                ["lifetime_hours"] = _options.EmailChangeLifetimeHours
                    .ToString(CultureInfo.InvariantCulture)
            });
    }

    private OutboxEmail CreateEmailChangedSecurityNotice(string oldEmail) =>
        CreateTemplatedEmail(
            oldEmail,
            EmailTemplateNames.EmailChangedSecurityNotice);

    private OutboxEmail CreateTemplatedEmail(
        string recipient,
        string templateName,
        IReadOnlyDictionary<string, string>? variables = null)
    {
        var template = _emailTemplates.Render(templateName, variables);
        return new OutboxEmail(
            recipient,
            template.Subject,
            template.TextBody,
            template.HtmlBody);
    }

    private string BuildLink(string action, string token) =>
        $"{_options.PublicOrigin.TrimEnd('/')}/#action={Uri.EscapeDataString(action)}&token={Uri.EscapeDataString(token)}";

    private async Task<DataBase.Models.UsersModels.User> GetActiveUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        return await _db.Users.FirstOrDefaultAsync(
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
        if (_passwordService.VerifyPassword(user, user.PasswordHash, currentPassword) ==
            PasswordVerificationResult.Failed)
        {
            throw new InvalidCurrentPasswordException();
        }
    }

    private async Task ValidateNewPasswordAsync(string password)
    {
        var validation = await _passwordValidator.ValidateDetailedAsync(password);
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
