using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.Services.Auth.Abstraction;

public interface IUserDeviceSessionService
{
    Task<UserDeviceSession> CreateSessionAsync(
        User user,
        string? deviceName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserDeviceSessionResponse>> GetActiveSessionsAsync(
        Guid userId,
        Guid? currentDeviceSessionId,
        CancellationToken cancellationToken = default);

    Task<bool> RevokeSessionAsync(
        Guid userId,
        Guid sessionId,
        Guid currentDeviceSessionId,
        CancellationToken cancellationToken = default);

    Task<int> RevokeOtherSessionsAsync(
        Guid userId,
        Guid currentDeviceSessionId,
        CancellationToken cancellationToken = default);

    Task<int> RevokeAllSessionsAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
