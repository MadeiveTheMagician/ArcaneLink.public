using System.Security.Claims;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.DTOs.Login;
using ArcaneLink.DataBase.DTOs.Logout;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.Login.Abstractions;
using ArcaneLink.Services.Logout.Abstraction;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IUserRegistrationService _registrationService;
        private readonly ILoginService _loginService;
        private readonly IAuthTokenService _authTokenService;
        private readonly ILogoutService _logoutService;
        private readonly IUserDeviceSessionService _deviceSessionService;
        
        public AuthController(
            IUserRegistrationService registrationService,
            ILoginService loginService,
            IAuthTokenService authTokenService,
            ILogoutService logoutService,
            IUserDeviceSessionService deviceSessionService)
        {
            _registrationService = registrationService;
            _loginService = loginService;
            _authTokenService = authTokenService;
            _logoutService = logoutService;
            _deviceSessionService = deviceSessionService;
        }

        [HttpPost("register")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<UserResponse>> Register(
            [FromBody] CreateUserRequest request,
            CancellationToken cancellationToken)
        {
            var response = await _registrationService.RegisterAsync(
                request,
                cancellationToken);

            return Ok(response);
        }

        [HttpPost("login")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<LoginResponse>> Login(
            [FromBody] LoginRequest request,
            CancellationToken cancellationToken)
        {
            var response = await _loginService.LoginAsync(
                request,
                cancellationToken);

            SetRefreshTokenCookie(
                response.RefreshToken,
                response.RefreshTokenExpireAt);
            SetAssetAccessTokenCookie(
                response.AccessToken,
                response.AccessTokenExpireAt);

            return Ok(response);
        }

        [HttpPost("refresh")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<AuthTokenPair>> Refresh(
            [FromBody] RefreshTokenRequest? request,
            CancellationToken cancellationToken)
        {
            var refreshToken = ResolveRefreshToken(request);
            var response = await _authTokenService.RefreshTokenAsync(
                new RefreshTokenRequest { RefreshToken = refreshToken },
                cancellationToken);

            SetRefreshTokenCookie(
                response.RefreshToken,
                response.RefreshTokenExpiresAt);
            SetAssetAccessTokenCookie(
                response.AccessToken,
                response.AccessTokenExpiresAt);

            return Ok(response);
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout(
            [FromBody] LogoutRequest? request,
            CancellationToken cancellationToken)
        {
            await _logoutService.LogoutAsync(
                new LogoutRequest { RefreshToken = ResolveRefreshToken(request) },
                cancellationToken);
            ClearRefreshTokenCookie();
            ClearAssetAccessTokenCookie();
            return NoContent();
        }

        [Authorize]
        [HttpPost("logoutAll")]
        public async Task<IActionResult> LogoutAll(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            await _logoutService.LogoutAllAsync(
                userId.Value,
                cancellationToken);

            ClearRefreshTokenCookie();
            ClearAssetAccessTokenCookie();
            return NoContent();
        }

        [Authorize]
        [HttpGet("sessions")]
        public async Task<ActionResult<IReadOnlyList<UserDeviceSessionResponse>>> GetSessions(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var sessions = await _deviceSessionService.GetActiveSessionsAsync(
                userId.Value,
                GetCurrentDeviceSessionId(),
                cancellationToken);

            return Ok(sessions);
        }

        [Authorize]
        [HttpPost("sessions/{id:guid}/revoke")]
        public async Task<IActionResult> RevokeSession(
            Guid id,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();

            if (userId == null)
            {
                return Unauthorized();
            }

            var isRevoked = await _deviceSessionService.RevokeSessionAsync(
                userId.Value,
                id,
                cancellationToken);

            if (!isRevoked)
            {
                return NotFound();
            }

            return NoContent();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue("userId");

            return Guid.TryParse(userIdValue, out var userId)
                ? userId
                : null;
        }

        private Guid? GetCurrentDeviceSessionId()
        {
            var deviceSessionIdValue = User.FindFirstValue("deviceSessionId");

            return Guid.TryParse(deviceSessionIdValue, out var deviceSessionId)
                ? deviceSessionId
                : null;
        }

        private string? ResolveRefreshToken(RefreshTokenRequest? request)
        {
            return !string.IsNullOrWhiteSpace(request?.RefreshToken)
                ? request.RefreshToken
                : Request.Cookies[AuthCookieNames.RefreshToken];
        }

        private string? ResolveRefreshToken(LogoutRequest? request)
        {
            return !string.IsNullOrWhiteSpace(request?.RefreshToken)
                ? request.RefreshToken
                : Request.Cookies[AuthCookieNames.RefreshToken];
        }

        private void SetRefreshTokenCookie(string refreshToken, DateTime expiresAt)
        {
            Response.Cookies.Append(
                AuthCookieNames.RefreshToken,
                refreshToken,
                CreateRefreshTokenCookieOptions(expiresAt));
        }

        private void ClearRefreshTokenCookie()
        {
            Response.Cookies.Delete(
                AuthCookieNames.RefreshToken,
                CreateRefreshTokenCookieOptions(DateTimeOffset.UtcNow.AddDays(-1)));
        }

        private void SetAssetAccessTokenCookie(
            string accessToken,
            DateTime expiresAt)
        {
            Response.Cookies.Append(
                AuthCookieNames.AssetAccessToken,
                accessToken,
                CreateAssetAccessTokenCookieOptions(expiresAt));
        }

        private void ClearAssetAccessTokenCookie()
        {
            Response.Cookies.Delete(
                AuthCookieNames.AssetAccessToken,
                CreateAssetAccessTokenCookieOptions(DateTimeOffset.UtcNow.AddDays(-1)));
        }

        private CookieOptions CreateRefreshTokenCookieOptions(DateTimeOffset expiresAt)
        {
            return new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/api/auth",
                Expires = expiresAt
            };
        }

        private CookieOptions CreateAssetAccessTokenCookieOptions(
            DateTimeOffset expiresAt)
        {
            return new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Strict,
                Path = "/api/assets",
                Expires = expiresAt
            };
        }
    }
}
