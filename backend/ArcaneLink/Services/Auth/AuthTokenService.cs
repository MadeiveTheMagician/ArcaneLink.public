using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.DTOs.Logout;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Exceptions.AuthExceptions;
using ArcaneLink.Observability;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.JwtService;
using ArcaneLink.Services.JwtService.Abstariction;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.RequestInfo.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Auth
{
    // Сервис токенов авторизации.
    //
    // Отвечает за:
    // - создание JWT access token;
    // - создание refresh token;
    // - хеширование refresh token;
    // - добавление refresh token hash в DbContext;
    // - refresh token rotation.
    public class AuthTokenService : IAuthTokenService
    {
        private const int MaxRefreshTokenGenerationAttempts = 5;

        private readonly AppDbContext _db;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IRequestInfoService _requestInfoService;
        private readonly IRealtimeNotificationService _realtime;
        private readonly ILogger<AuthTokenService> _logger;
        private readonly JwtSettings _jwtSettings;

        public AuthTokenService(
            AppDbContext db,
            IJwtTokenService jwtTokenService,
            IRequestInfoService requestInfoService,
            IRealtimeNotificationService realtime,
            ILogger<AuthTokenService> logger,
            IOptions<JwtSettings> jwtOptions)
        {
            this._db = db;
            this._jwtTokenService = jwtTokenService;
            this._requestInfoService = requestInfoService;
            this._realtime = realtime;
            this._logger = logger;
            this._jwtSettings = jwtOptions.Value;
        }

        // Создаёт новую пару токенов для пользователя.
        //
        // Используется при login.
        //
        // SaveChangesAsync здесь НЕ вызывается:
        // LoginService сохраняет password rehash и refresh token
        // одной операцией.
        // ----------------------------------- СОЗДАНИЕ ПАРЫ ТОКЕНОВ (LOGIN) ---------------------------
        public async Task<AuthTokenPair> CreateTokenPairAsync(
            User user,
            Guid deviceSessionId,
            CancellationToken cancellationToken = default)
        {
            var accessToken = this._jwtTokenService.GenerateAccessToken(
                user,
                deviceSessionId);
            var accessTokenExpiresAt = this._jwtTokenService.GetAccessTokenExpirationUtc();

            var refreshToken = await this.CreateRefreshTokenEntityAsync(
                user.Id,
                deviceSessionId,
                cancellationToken);

            return new AuthTokenPair
            {
                AccessToken = accessToken,
                AccessTokenExpiresAt = accessTokenExpiresAt,

                RefreshToken = refreshToken.RawToken,
                RefreshTokenExpiresAt = refreshToken.Entity.ExpiresAt,

                DeviceSessionId = deviceSessionId
            };
        }

        // -------------------------------- ОБНОВЛЕНИЕ ТОКЕНА (REFRESH) ---------------------------
        // Обновляет пару токенов по refresh token.
        //
        // Использует rotation pattern:
        // - старый refresh token становится revoked;
        // - создаётся новый refresh token;
        // - старый токен получает ссылку ReplacedByTokenId на новый.
        public async Task<AuthTokenPair> RefreshTokenAsync(
            RefreshTokenRequest request,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                throw new InvalidRefreshTokenException();
            }

            var refreshTokenHash =
                this._jwtTokenService.HashRefreshToken(request.RefreshToken);

            var existingToken = await this._db.UserRefreshTokens
                .Include(x => x.User)
                .Include(x => x.DeviceSession)
                .FirstOrDefaultAsync(
                    x => x.TokenHash == refreshTokenHash,
                    cancellationToken);

            if (existingToken == null ||
                existingToken.RevokedAt != null ||
                existingToken.ExpiresAt <= DateTime.UtcNow)
            {
                throw new InvalidRefreshTokenException();
            }


            // Если пользователь после логина был забанен,
            // удалён или переведён в неактивный статус,
            // refresh token больше не должен выдавать новые JWT.

            if (existingToken.User.StatusId != UserStatusIds.Active
                || existingToken.User.DeletedAt != null)
            {
                throw new InvalidRefreshTokenException();
            }

            if (existingToken.DeviceSession == null ||
                existingToken.DeviceSession.RevokedAt != null)
            {
                throw new InvalidRefreshTokenException();
            }

            var now = DateTime.UtcNow;
            var deviceSession = existingToken.DeviceSession;
            if (this.IsDeviceSessionExpired(deviceSession, now))
            {
                deviceSession.RevokedAt = now;
                deviceSession.LastUsedAt = now;
                existingToken.RevokedAt = now;
                existingToken.RevokedByIp = this._requestInfoService.GetClientIpAddress();
                await this._db.SaveChangesAsync(cancellationToken);
                throw new InvalidRefreshTokenException();
            }

            // Старый refresh token больше нельзя использовать.
            existingToken.RevokedAt = now;
            existingToken.RevokedByIp = this._requestInfoService.GetClientIpAddress();

            deviceSession.LastUsedAt = now;
            deviceSession.IpAddress = this._requestInfoService.GetClientIpAddress();
            deviceSession.UserAgent = this._requestInfoService.GetUserAgent();

            // Создаём новый access token.
            var newAccessToken = this._jwtTokenService.GenerateAccessToken(
                existingToken.User,
                deviceSession.Id);
            var newAccessTokenExpiresAt = this._jwtTokenService.GetAccessTokenExpirationUtc();

            // Создаём новый refresh token и добавляем его entity в DbContext.
            var newRefreshToken = await this.CreateRefreshTokenEntityAsync(
                existingToken.UserId,
                existingToken.DeviceSessionId,
                cancellationToken);

            // Связываем старый refresh token с новым.
            // Это полезно для аудита и расследования подозрительных сессий.
            existingToken.ReplacedByTokenId = newRefreshToken.Entity.Id;

            await this._db.SaveChangesAsync(cancellationToken);
            ArcaneLinkDiagnostics.RefreshTokenRotatedCounter.Add(1);
            this._logger.LogInformation(
                ObservabilityEventIds.RefreshTokenRotated,
                "Refresh token rotated. UserId={UserId} DeviceSessionId={DeviceSessionId} OldRefreshTokenId={OldRefreshTokenId} NewRefreshTokenId={NewRefreshTokenId}",
                existingToken.UserId,
                existingToken.DeviceSessionId,
                existingToken.Id,
                newRefreshToken.Entity.Id);

            return new AuthTokenPair
            {
                AccessToken = newAccessToken,
                AccessTokenExpiresAt = newAccessTokenExpiresAt,

                RefreshToken = newRefreshToken.RawToken,
                RefreshTokenExpiresAt = newRefreshToken.Entity.ExpiresAt,

                DeviceSessionId = existingToken.DeviceSessionId
            };
        }


        // -------------------------------- REVOKE РЕФРЕШ ТОКЕНА ---------------------------
        // Отмечает refresh token как revoked, чтобы он больше не мог использоваться для обновления access token.
        public async Task RevokeTokenAsync(
            LogoutRequest request,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                return;
            }

            var refreshTokenHash = this._jwtTokenService.HashRefreshToken(request.RefreshToken);

            var existingToken = await this._db.UserRefreshTokens
                .Include(x => x.DeviceSession)
                .FirstOrDefaultAsync(
                    x => x.TokenHash == refreshTokenHash,
                    cancellationToken);

            if (existingToken == null || existingToken.RevokedAt != null)
            {
                return;
            }

            existingToken.RevokedAt = DateTime.UtcNow;
            existingToken.RevokedByIp = this._requestInfoService.GetClientIpAddress();

            if (existingToken.DeviceSession != null)
            {
                existingToken.DeviceSession.RevokedAt = existingToken.RevokedAt;
                existingToken.DeviceSession.LastUsedAt = existingToken.RevokedAt.Value;
            }

            await this._db.SaveChangesAsync(cancellationToken);
            await this._realtime.NotifyUserAsync(
                existingToken.UserId,
                RealtimeEventNames.UserSessionsChanged,
                new { sessionId = existingToken.DeviceSessionId },
                cancellationToken);

            if (existingToken.DeviceSessionId != null)
            {
                await this._realtime.NotifyUserAsync(
                    existingToken.UserId,
                    RealtimeEventNames.CurrentSessionRevoked,
                    new { sessionId = existingToken.DeviceSessionId },
                    cancellationToken);
            }
        }

        // -------------------------------- REVOKE ВСЕХ РЕФРЕШ ТОКЕНОВ У КОНКРЕТНОГО ПОЛЬЗОВАТЕЛЯ ---------------------------
        // Отмечает refresh token как revoked, чтобы он больше не мог использоваться для обновления access token.
        public async Task RevokeAllTokensAsync(
            Guid userId,
            CancellationToken cancellationToken)
        {
            var userTokens = await this._db.UserRefreshTokens
                .Where(x => x.UserId == userId && x.RevokedAt == null)
                .ToListAsync(cancellationToken);
            var now = DateTime.UtcNow;
            foreach (var token in userTokens)
            {
                token.RevokedAt = now;
                token.RevokedByIp = this._requestInfoService.GetClientIpAddress();
            }

            var userDeviceSessions = await this._db.UserDeviceSessions
                .Where(x => x.UserId == userId && x.RevokedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var session in userDeviceSessions)
            {
                session.RevokedAt = now;
                session.LastUsedAt = now;
            }

            await this._db.SaveChangesAsync(cancellationToken);
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

        // -------------------------------- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ --------------------------------
        // Создаёт entity refresh token.
        //
        // RawToken:
        // - отдаётся клиенту;
        // - больше никогда не хранится на сервере в открытом виде.
        //
        // Entity.TokenHash:
        // - сохраняется в БД;
        // - используется для поиска refresh token при обновлении.
        private async Task<CreatedRefreshTokenResult> CreateRefreshTokenEntityAsync(
            Guid userId,
            Guid? deviceSessionId,
            CancellationToken cancellationToken)
        {
            var refreshTokenResult = await this.GenerateUniqueRefreshTokenAsync(
                cancellationToken);

            var entity = new UserRefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DeviceSessionId = deviceSessionId,
                TokenHash = refreshTokenResult.Hash,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = this._jwtTokenService.GetRefreshTokenExpirationUtc(),
                CreatedByIp = this._requestInfoService.GetClientIpAddress(),
                UserAgent = this._requestInfoService.GetUserAgent()
            };

            this._db.UserRefreshTokens.Add(entity);

            return new CreatedRefreshTokenResult(
                refreshTokenResult.RawToken,
                entity);
        }

        // Генерирует refresh token и проверяет,
        // что его hash ещё не существует в БД.
        private async Task<RefreshTokenGenerationResult> GenerateUniqueRefreshTokenAsync(
            CancellationToken cancellationToken)
        {
            for (var attempt = 1; attempt <= MaxRefreshTokenGenerationAttempts; attempt++)
            {
                var refreshToken = this._jwtTokenService.GenerateRefreshToken();
                var refreshTokenHash = this._jwtTokenService.HashRefreshToken(refreshToken);

                var alreadyExists = await this._db.UserRefreshTokens
                    .AnyAsync(
                        x => x.TokenHash == refreshTokenHash,
                        cancellationToken);

                if (!alreadyExists)
                {
                    return new RefreshTokenGenerationResult(
                        refreshToken,
                        refreshTokenHash);
                }
            }

            throw new RefreshTokenGenerationFailedException();
        }

        private bool IsDeviceSessionExpired(UserDeviceSession session, DateTime now)
        {
            return IsOlderThan(session.LastUsedAt, now, this._jwtSettings.DeviceSessionIdleExpirationDays) ||
                   IsOlderThan(session.CreatedAt, now, this._jwtSettings.DeviceSessionAbsoluteExpirationDays);
        }

        private static bool IsOlderThan(DateTime value, DateTime now, int days)
        {
            return days > 0 && value.AddDays(days) <= now;
        }

        // Результат создания refresh token entity.
        //
        // RawToken — отдаём клиенту.
        // Entity — сохраняем в БД.
        private sealed record CreatedRefreshTokenResult(
            string RawToken,
            UserRefreshToken Entity);

        // Результат генерации refresh token.
        //
        // RawToken — открытое значение токена.
        // Hash — безопасное значение для хранения в БД.
        private sealed record RefreshTokenGenerationResult(
            string RawToken,
            string Hash);


    }
}
