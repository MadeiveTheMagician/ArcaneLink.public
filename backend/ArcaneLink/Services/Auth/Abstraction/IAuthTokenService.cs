using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.DTOs.Logout;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.Services.Auth.Abstraction
{
    public interface IAuthTokenService
    {
        Task<AuthTokenPair> CreateTokenPairAsync
            (
            User user,
            Guid deviceSessionId,
            CancellationToken cancellationToken = default
            );

        Task<AuthTokenPair> RefreshTokenAsync
            (
            RefreshTokenRequest request,
            CancellationToken cancellationToken = default
            );

        Task RevokeTokenAsync
            (
            LogoutRequest request,
            CancellationToken cancellationToken = default
            );

        Task RevokeAllTokensAsync
            (
            Guid userId,
            CancellationToken cancellationToken = default
            );
    }

}
