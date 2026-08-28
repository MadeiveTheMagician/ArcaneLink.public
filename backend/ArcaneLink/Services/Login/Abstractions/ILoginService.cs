using ArcaneLink.DataBase.DTOs.Login;
using ArcaneLink.DataBase.DTOs.Logout;

namespace ArcaneLink.Services.Login.Abstractions;

public interface ILoginService
{
    Task<LoginResponse> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default);
}
