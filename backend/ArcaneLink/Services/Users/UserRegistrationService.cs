using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Services.Validators;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ArcaneLink.Services.Users;

// Сервис регистрации пользователей.
//
// Отвечает за полный процесс регистрации:
// 1. Проверяет входные строки после Trim()
// 2. Проверяет уникальность login/email через UserValidationService
// 3. Создаёт User
// 4. Хеширует пароль
// 5. Создаёт UserProfile
// 6. Сохраняет данные в транзакции
// 7. Обрабатывает race condition по уникальным индексам БД
public class UserRegistrationService : IUserRegistrationService
{
    private readonly AppDbContext _db;
    private readonly IUserValidationService _validationService;
    private readonly IUserPasswordService _passwordService;
    private readonly PasswordValidator _passwordValidator;
    private readonly IAccountLifecycleService _accountLifecycleService;

    public UserRegistrationService(
        AppDbContext db,
        IUserValidationService validationService,
        IUserPasswordService passwordService,
        PasswordValidator passwordValidator,
        IAccountLifecycleService accountLifecycleService)
    {
        this._db = db;
        this._validationService = validationService;
        this._passwordService = passwordService;
        this._passwordValidator = passwordValidator;
        this._accountLifecycleService = accountLifecycleService;
    }

    public async Task<UserResponse> RegisterAsync(
        CreateUserRequest request,
        CancellationToken cancellationToken = default)
    {
        // Один раз очищаем входные строки от пробелов по краям.
        var login = request.Login.Trim();
        var email = request.Email.Trim();
        var displayName = request.DisplayName.Trim();

        // Дополнительная проверка после Trim().
        //
        // DataAnnotations [MinLength] проверяет исходную строку.
        // Например "   " может пройти часть проверок,
        // но после Trim() станет пустой строкой.
        if (string.IsNullOrWhiteSpace(login))
        {
            throw new InvalidUserRegistrationDataException(ExceptionMessages.LoginIsRequired);
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new InvalidUserRegistrationDataException(ExceptionMessages.EmailIsRequired);
        }

        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new InvalidUserRegistrationDataException(ExceptionMessages.DisplayNameIsRequired);
        }

        var passwordValidationResult = await this._passwordValidator
            .ValidateDetailedAsync(request.Password);

        if (!passwordValidationResult.IsValid)
        {
            throw new InvalidUserRegistrationDataException(
                ExceptionMessages.PasswordIsInvalid,
                passwordValidationResult.Errors);
        }

        // Нормализуем значения для поиска и уникальности.
        var loginNorm = login.ToUpperInvariant();
        var emailNorm = email.ToUpperInvariant();
        var displayNameNorm = displayName.ToUpperInvariant();

        // Предварительная бизнес-проверка.
        //
        // Она нужна для нормального UX:
        // если логин/email заняты — вернём понятную ошибку до SaveChanges.
        await this._validationService.ValidateRegistrationAsync(
            login,
            email,
            cancellationToken);

        var user = new User
        {
            Id = Guid.NewGuid(),

            Login = login,
            LoginNorm = loginNorm,

            Email = email,
            EmailNorm = emailNorm,

            PasswordHash = string.Empty,

            StatusId = UserStatusIds.PendingEmailVerification,
            SubscriptionTypeId = SubscriptionTypeIds.Free,

            CreatedAt = DateTime.UtcNow
        };

        // В базу сохраняется только хеш, не сырой пароль.
        user.PasswordHash = this._passwordService.HashPassword(
            user,
            request.Password);

        var profile = new UserProfile
        {
            UserId = user.Id,

            DisplayName = displayName,
            DisplayNameNorm = displayNameNorm,

            AvatarAssetId = null,
            BannerAssetId = null,

            UpdatedAt = DateTime.UtcNow
        };

        var profileSettings = new UserProfileSettings
        {
            UserId = user.Id,
            InterfaceScale = 1,
            FontScale = 1,
            ServerInterfaceScale = 1,
            IsServerRailPinned = false,
            ShowPrivateReadAllButton = true,
            IsAllPrivateSpaceOrderLocked = false,
            ServerMessageDisplayFormat =
                MessageDisplayFormatCodes.WallScroll,
            PrivateMessageDisplayFormat =
                MessageDisplayFormatCodes.WallScroll,
            ServerMessageBubbleAlignment =
                MessageBubbleAlignmentCodes.OwnRight,
            PrivateMessageBubbleAlignment =
                MessageBubbleAlignmentCodes.OwnRight,
            ServerMessageBubbleWidth =
                MessageBubbleWidthCodes.Standard,
            PrivateMessageBubbleWidth =
                MessageBubbleWidthCodes.Standard,
            ExpandMessageAttachmentsByDefault = false,
            LoadExternalMediaPreviews = true,
            HorizontalVideoCardSize = 3,
            VerticalVideoCardSize = 3,
            SelectedThemeId = SystemThemeIds.Sapphire,
            ProfileColor = null,
            ApplySystemThemeToOtherProfiles = true,
            DirectMessagePermission = DirectMessagePrivacyCodes.Everyone,
            PresenceVisibility = PresenceVisibilityCodes.Everyone,
            ShowLastSeen = true,
            PresenceMode = PresenceModeCodes.Automatic,
            UpdatedAt = DateTime.UtcNow
        };

        this._db.Users.Add(user);
        this._db.UserProfiles.Add(profile);
        this._db.UserProfileSettings.Add(profileSettings);

        try
        {
            // Транзакция нужна, чтобы User, Profile и Settings
            // создавались атомарно вместе с одноразовым токеном и
            // зашифрованной outbox-записью письма.
            await using var transaction = await this._db.Database
                .BeginTransactionAsync(cancellationToken);
            // Важный момент:
            //
            // Даже если предварительная проверка прошла,
            // другой запрос мог успеть создать такого же пользователя
            // между AnyAsync и SaveChangesAsync.
            //
            // Поэтому уникальные индексы БД остаются последней защитой.
            await this._db.SaveChangesAsync(cancellationToken);

            await this._accountLifecycleService.QueueRegistrationVerificationAsync(
                user.Id,
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        // Обрабатываем ошибку сохранения, которая может возникнуть из-за нарушения уникальных индексов.
        // Например, если два запроса одновременно пытаются зарегистрировать одного и того же пользователя,
        // один из них может пройти предварительную проверку, а другой — нет.
        // В этом случае SaveChangesAsync выбросит DbUpdateException с внутренним PostgresException.
        // Мы перехватываем эту ошибку и преобразуем её в понятную доменную ошибку,
        // которую может обработать контроллер и вернуть клиенту.
        catch (DbUpdateException ex)
        {
            var mappedException = MapDbUpdateException(ex);

            if (mappedException != ex)
            {
                throw mappedException;
            }

            throw;
        }

        return new UserResponse
        {
            Id = user.Id,
            Login = user.Login,
            DisplayName = profile.DisplayName,
            Email = user.Email,
            SubscriptionType = new SubscriptionTypeResponse
            {
                Id = SubscriptionTypeIds.Free,
                Code = "free",
                Title = "Free",
                Rank = 0
            },
            CreatedAt = user.CreatedAt,
            PresenceStatus = PresenceStatusCodes.Offline,
            LastSeenAt = null,
            EmailConfirmedAt = null
        };
    }

    // Преобразует низкоуровневую ошибку БД
    // в понятную доменную ошибку пользовательского модуля.
    private static Exception MapDbUpdateException(DbUpdateException ex)
    {
        if (ex.InnerException is PostgresException postgresException)
        {
            // 23505 — PostgreSQL unique_violation.
            //
            // Это означает, что был нарушен уникальный индекс.
            if (postgresException.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return postgresException.ConstraintName switch
                {
                    "UX_Users_LoginNorm" => new LoginAlreadyExistsException(),
                    "UX_Users_EmailNorm" => new EmailAlreadyExistsException(),

                    _ => ex
                };
            }
        }

        return ex;
    }
}
