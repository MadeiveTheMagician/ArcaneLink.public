using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.RequestInfo.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Auth
{
    public class UserDeviceSessionService : IUserDeviceSessionService
    {
        private readonly IRequestInfoService _requestInfoService;
        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;

        public UserDeviceSessionService(
            IRequestInfoService requestInfoService,
            AppDbContext db,
            IRealtimeNotificationService realtime)
        {
            this._requestInfoService = requestInfoService;
            this._db = db;
            this._realtime = realtime;
        }

        public Task<UserDeviceSession> CreateSessionAsync(
            User user,
            string? deviceName,
            CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;

            var session = new UserDeviceSession
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                User = user,
                CreatedAt = now,
                LastUsedAt = now,
                IpAddress = this._requestInfoService.GetClientIpAddress(),
                UserAgent = this._requestInfoService.GetUserAgent(),
                DeviceName = string.IsNullOrWhiteSpace(deviceName)
                    ? null
                    : deviceName.Trim()
            };

            return Task.FromResult(session);
        }

        public async Task<IReadOnlyList<UserDeviceSessionResponse>> GetActiveSessionsAsync(
            Guid userId,
            Guid? currentDeviceSessionId,
            CancellationToken cancellationToken = default)
        {
            return await this._db.UserDeviceSessions
                .AsNoTracking()
                .Where(x => x.UserId == userId && x.RevokedAt == null)
                .OrderByDescending(x => x.LastUsedAt)
                .Select(x => new UserDeviceSessionResponse
                {
                    Id = x.Id,
                    DeviceName = x.DeviceName,
                    IpAddress = x.IpAddress,
                    UserAgent = x.UserAgent,
                    CreatedAt = x.CreatedAt,
                    LastUsedAt = x.LastUsedAt,
                    IsCurrent = currentDeviceSessionId != null &&
                                x.Id == currentDeviceSessionId.Value
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<bool> RevokeSessionAsync(
            Guid userId,
            Guid sessionId,
            Guid currentDeviceSessionId,
            CancellationToken cancellationToken = default)
        {
            if (sessionId == currentDeviceSessionId)
            {
                return false;
            }

            var session = await this._db.UserDeviceSessions
                .FirstOrDefaultAsync(
                    x => x.Id == sessionId &&
                         x.Id != currentDeviceSessionId &&
                         x.UserId == userId &&
                         x.RevokedAt == null,
                    cancellationToken);

            if (session == null)
            {
                return false;
            }

            var now = DateTime.UtcNow;
            session.RevokedAt = now;
            session.LastUsedAt = now;

            var sessionRefreshTokens = await this._db.UserRefreshTokens
                .Where(x => x.DeviceSessionId == session.Id &&
                            x.RevokedAt == null)
                .ToListAsync(cancellationToken);

            var revokedByIp = this._requestInfoService.GetClientIpAddress();

            foreach (var token in sessionRefreshTokens)
            {
                token.RevokedAt = now;
                token.RevokedByIp = revokedByIp;
            }

            await this._db.SaveChangesAsync(cancellationToken);
            await this._realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.UserSessionsChanged,
                new { sessionId },
                cancellationToken);
            await this._realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.CurrentSessionRevoked,
                new { sessionId },
                cancellationToken);

            return true;
        }

        public async Task<int> RevokeOtherSessionsAsync(
            Guid userId,
            Guid currentDeviceSessionId,
            CancellationToken cancellationToken = default)
        {
            var sessions = await this._db.UserDeviceSessions
                .Where(x => x.UserId == userId &&
                            x.Id != currentDeviceSessionId &&
                            x.RevokedAt == null)
                .ToListAsync(cancellationToken);

            if (sessions.Count == 0)
            {
                return 0;
            }

            var sessionIds = sessions.Select(x => x.Id).ToArray();
            var now = DateTime.UtcNow;
            var revokedByIp = this._requestInfoService.GetClientIpAddress();

            foreach (var session in sessions)
            {
                session.RevokedAt = now;
                session.LastUsedAt = now;
            }

            var sessionRefreshTokens = await this._db.UserRefreshTokens
                .Where(x => x.DeviceSessionId != null &&
                            sessionIds.Contains(x.DeviceSessionId.Value) &&
                            x.RevokedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var token in sessionRefreshTokens)
            {
                token.RevokedAt = now;
                token.RevokedByIp = revokedByIp;
            }

            await this._db.SaveChangesAsync(cancellationToken);
            await this._realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.UserSessionsChanged,
                new { sessionIds },
                cancellationToken);

            foreach (var sessionId in sessionIds)
            {
                await this._realtime.NotifyUserAsync(
                    userId,
                    RealtimeEventNames.CurrentSessionRevoked,
                    new { sessionId },
                    cancellationToken);
            }

            return sessionIds.Length;
        }

        public async Task<int> RevokeAllSessionsAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var sessions = await this._db.UserDeviceSessions
                .Where(x => x.UserId == userId && x.RevokedAt == null)
                .ToListAsync(cancellationToken);
            var tokens = await this._db.UserRefreshTokens
                .Where(x => x.UserId == userId && x.RevokedAt == null)
                .ToListAsync(cancellationToken);
            var now = DateTime.UtcNow;
            var revokedByIp = this._requestInfoService.GetClientIpAddress();

            foreach (var session in sessions)
            {
                session.RevokedAt = now;
                session.LastUsedAt = now;
            }

            foreach (var token in tokens)
            {
                token.RevokedAt = now;
                token.RevokedByIp = revokedByIp;
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

            return sessions.Count;
        }
    }
}
