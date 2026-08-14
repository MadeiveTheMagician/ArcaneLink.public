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
            _requestInfoService = requestInfoService;
            _db = db;
            _realtime = realtime;
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
                IpAddress = _requestInfoService.GetClientIpAddress(),
                UserAgent = _requestInfoService.GetUserAgent(),
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
            return await _db.UserDeviceSessions
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
            CancellationToken cancellationToken = default)
        {
            var session = await _db.UserDeviceSessions
                .FirstOrDefaultAsync(
                    x => x.Id == sessionId &&
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

            var sessionRefreshTokens = await _db.UserRefreshTokens
                .Where(x => x.DeviceSessionId == session.Id &&
                            x.RevokedAt == null)
                .ToListAsync(cancellationToken);

            var revokedByIp = _requestInfoService.GetClientIpAddress();

            foreach (var token in sessionRefreshTokens)
            {
                token.RevokedAt = now;
                token.RevokedByIp = revokedByIp;
            }

            await _db.SaveChangesAsync(cancellationToken);
            await _realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.UserSessionsChanged,
                new { sessionId },
                cancellationToken);
            await _realtime.NotifyUserAsync(
                userId,
                RealtimeEventNames.CurrentSessionRevoked,
                new { sessionId },
                cancellationToken);

            return true;
        }
    }
}
