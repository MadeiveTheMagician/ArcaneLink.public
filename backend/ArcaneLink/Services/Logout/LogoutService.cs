using ArcaneLink.DataBase.DTOs.Logout;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.Logout.Abstraction;

namespace ArcaneLink.Services.Logout;

public class LogoutService : ILogoutService
{
    private readonly IAuthTokenService _authTokenService;

    public LogoutService(IAuthTokenService authTokenService)
    {
        this._authTokenService = authTokenService;
    }

    //  -------------------------------- LOGOUT ALL  ---------------------------
    // Метод логаута со всех устройств.
    // Отзывает все активные refresh tokens пользователя.
    // После этого пользователь не сможет обновлять access tokens.
    //
    // Важно:
    // уже выданные access tokens останутся валидными до истечения срока жизни.

    public async Task LogoutAllAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await this._authTokenService.RevokeAllTokensAsync(userId, cancellationToken);
    }

    // -------------------------------- LOGOUT  ---------------------------
    // Метод логаута с одного устройства.
    // Удаляет конкретный refresh токен из БД, тем самым делая невалидным связанный с ним access токен.
    // Используется при logout с одного устройства, например при выходе из аккаунта на конкретном устройстве,
    // или при подозрении на компрометацию конкретного устройства, что может свидетельствовать о несанкционированном доступе.
    public async Task LogoutAsync(LogoutRequest request, CancellationToken cancellationToken)
    {
        await this._authTokenService.RevokeTokenAsync(request, cancellationToken);
    }
}
