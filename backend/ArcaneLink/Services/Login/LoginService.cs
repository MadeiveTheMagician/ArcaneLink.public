using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Login;
using ArcaneLink.DataBase.DTOs.Logout;
using ArcaneLink.Exceptions.AuthExceptions;
using ArcaneLink.Exceptions.LoginExceptions;
using ArcaneLink.Observability;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.JwtService.Abstariction;
using ArcaneLink.Services.Login.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Login
{
    // Сервис логина.
    //
    // Отвечает за:
    // - поиск пользователя по login/email;
    // - проверку статуса аккаунта;
    // - проверку пароля;
    // - создание access/refresh token через AuthTokenService;
    // - возврат безопасного LoginResponse.
    public class LoginService : ILoginService
    {
        // Контекст базы данных.
        private readonly AppDbContext _db;

        // Сервис проверки/хеширования паролей.
        private readonly IUserPasswordService _passwordService;

        // Сервис создания пары токенов:
        // - JWT access token;
        // - refresh token + запись hash в БД.
        private readonly IAuthTokenService _authTokenService;
        private readonly IUserDeviceSessionService _deviceSessionService;
        private readonly IRealtimeNotificationService _realtime;
        private readonly ILogger<LoginService> _logger;
        public LoginService(
            AppDbContext db,
            IUserPasswordService passwordService,
            IAuthTokenService authTokenService,
            IUserDeviceSessionService deviceSessionService,
            IRealtimeNotificationService realtime,
            ILogger<LoginService> logger)
        {
            _db = db;
            _passwordService = passwordService;
            _authTokenService = authTokenService;
            _deviceSessionService = deviceSessionService;
            _realtime = realtime;
            _logger = logger;
        }

        // Метод логина.
        //
        // На вход принимает LoginRequest:
        // - LoginOrEmail;
        // - Password.
        //
        // На выход возвращает LoginResponse:
        // - данные пользователя;
        // - access token;
        // - refresh token;
        // - сроки жизни токенов.


        // -------------------------------- ЛОГИН ---------------------------
        public async Task<LoginResponse> LoginAsync(
            LoginRequest request,
            CancellationToken cancellationToken = default)
        {
            // Убираем лишние пробелы.
            var loginOrEmail = request.LoginOrEmail.Trim();

            // Приводим login/email к нормализованному виду.
            // В базе поиск идёт по LoginNorm / EmailNorm.
            var loginOrEmailNorm = loginOrEmail.ToUpperInvariant();

            // Ищем пользователя по login или email.
            //
            // Include(u => u.Profile) нужен,
            // чтобы сразу получить DisplayName без отдельного запроса.
            var user = await _db.Users
                .Include(u => u.Profile)
                .Include(u => u.SubscriptionType)
                .FirstOrDefaultAsync(
                    u => u.LoginNorm == loginOrEmailNorm ||
                         u.EmailNorm == loginOrEmailNorm,
                    cancellationToken);

            // Если пользователь не найден,
            // аккаунт не активен,
            // или аккаунт soft-deleted —
            // возвращаем единую ошибку.
            //
            // Это защищает от user enumeration:
            // нельзя понять, существует login/email или нет.
            if (user == null)
            {
                _passwordService.PerformDummyVerification(request.Password);
                throw new InvalidLoginCredentialsException();
            }

            // Проверяем пароль.
            //
            // Важно:
            // пароль НЕ хешируется заново вручную для сравнения.
            // PasswordHasher сам достаёт salt/параметры из PasswordHash.
            var passwordResult = _passwordService.VerifyPassword(
                user,
                user.PasswordHash,
                request.Password);

            // Если пароль неверный — та же единая ошибка.
            if (passwordResult == PasswordVerificationResult.Failed)
            {
                throw new InvalidLoginCredentialsException();
            }

            if (user.DeletedAt != null)
            {
                throw new InvalidLoginCredentialsException();
            }

            if (user.StatusId == UserStatusIds.Banned)
            {
                throw new UserWasBannedException();
            }

            if (user.StatusId == UserStatusIds.PendingEmailVerification ||
                user.EmailConfirmedAt == null)
            {
                throw new EmailNotConfirmedException();
            }

            if (user.StatusId != UserStatusIds.Active)
            {
                throw new InvalidLoginCredentialsException();
            }

            // Один общий момент времени для всей операции логина.
            var now = DateTime.UtcNow;

            // Если PasswordHasher считает старый hash устаревшим,
            // обновляем его прямо во время успешного логина.
            //
            // Например, если в будущем изменятся параметры хеширования.
            if (passwordResult == PasswordVerificationResult.SuccessRehashNeeded)
            {
                user.PasswordHash = _passwordService.HashPassword(
                    user,
                    request.Password);
            }

            // Создаём device session и пару токенов.
            //
            // AuthTokenService должен:
            // - создать access token;
            // - создать refresh token;
            // - захешировать refresh token;
            // - добавить UserRefreshToken в DbContext.
            //
            // Важно:
            // SaveChangesAsync лучше делать здесь, в LoginService,
            // чтобы rehash пароля и refresh token
            // сохранились одной операцией.
            var deviceSession = await _deviceSessionService.CreateSessionAsync(
                user,
                request.DeviceName,
                cancellationToken);

            _db.UserDeviceSessions.Add(deviceSession);

            var tokenPair = await _authTokenService.CreateTokenPairAsync(
                user,
                deviceSession.Id,
                cancellationToken);

            // Сохраняем:
            // - новый PasswordHash, если был SuccessRehashNeeded;
            // - UserRefreshToken, добавленный AuthTokenService.
            await _db.SaveChangesAsync(cancellationToken);
            await _realtime.NotifyUserAsync(
                user.Id,
                RealtimeEventNames.UserSessionsChanged,
                new { sessionId = deviceSession.Id },
                cancellationToken);
            ArcaneLinkDiagnostics.LoginSucceededCounter.Add(1);
            _logger.LogInformation(
                ObservabilityEventIds.UserLoginSucceeded,
                "User login succeeded. UserId={UserId} DeviceSessionId={DeviceSessionId}",
                user.Id,
                deviceSession.Id);

            // Возвращаем клиенту безопасный ответ.
            //
            // PasswordHash, StatusId, DeletedAt и прочие внутренние поля
            // наружу не отдаём.
            return new LoginResponse
            {
                Id = user.Id,
                Login = user.Login,
                DisplayName = user.Profile?.DisplayName ?? user.Login,
                Email = user.Email,
                SubscriptionType = new ArcaneLink.DataBase.DTOs.Users.SubscriptionTypeResponse
                {
                    Id = user.SubscriptionType.Id,
                    Code = user.SubscriptionType.Code,
                    Title = user.SubscriptionType.Title,
                    Rank = user.SubscriptionType.Rank
                },

                LoggedInAt = now,

                AccessToken = tokenPair.AccessToken,
                AccessTokenExpireAt = tokenPair.AccessTokenExpiresAt,

                RefreshToken = tokenPair.RefreshToken,
                RefreshTokenExpireAt = tokenPair.RefreshTokenExpiresAt,
                DeviceSessionId = tokenPair.DeviceSessionId
            };
        }

    }
}
