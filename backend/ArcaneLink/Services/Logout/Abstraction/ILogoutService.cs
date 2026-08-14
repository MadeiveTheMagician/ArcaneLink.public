using ArcaneLink.DataBase.DTOs.Logout;

namespace ArcaneLink.Services.Logout.Abstraction
{
    public interface ILogoutService
    {
        Task LogoutAsync
            (
                LogoutRequest request,
                CancellationToken cancellationToken = default
            );
        Task LogoutAllAsync
            (
                Guid userId,
                CancellationToken cancellationToken = default   
            );
    }
}
