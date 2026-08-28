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
        private readonly IAccountLifecycleService _accountLifecycleService;
        
        public AuthController(
            IUserRegistrationService registrationService,
            ILoginService loginService,
            IAuthTokenService authTokenService,
            ILogoutService logoutService,
            IUserDeviceSessionService deviceSessionService,
            IAccountLifecycleService accountLifecycleService)
        {
            _registrationService = registrationService;
            _loginService = loginService;
            _authTokenService = authTokenService;
            _logoutService = logoutService;
            _deviceSessionService = deviceSessionService;
            _accountLifecycleService = accountLifecycleService;
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

        [HttpPost("email/resend")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<AcceptedAccountActionResponse>> ResendEmailVerification(
            [FromBody] ResendVerificationEmailRequest request,
            CancellationToken cancellationToken)
        {
            await _accountLifecycleService.QueueVerificationResendAsync(
                request.Email,
                cancellationToken);
            return Accepted(CreateAcceptedResponse());
        }

        [HttpPost("email/confirm")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<ConfirmEmailResponse>> ConfirmEmail(
            [FromBody] EmailTokenRequest request,
            CancellationToken cancellationToken)
        {
            return Ok(await _accountLifecycleService.ConfirmEmailAsync(
                request.Token,
                cancellationToken));
        }

        [HttpPost("password/forgot")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<AcceptedAccountActionResponse>> ForgotPassword(
            [FromBody] ForgotPasswordRequest request,
            CancellationToken cancellationToken)
        {
            await _accountLifecycleService.QueuePasswordResetAsync(
                request.LoginOrEmail,
                cancellationToken);
            return Accepted(CreateAcceptedResponse());
        }

        [HttpPost("password/reset")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<IActionResult> ResetPassword(
            [FromBody] ResetPasswordRequest request,
            CancellationToken cancellationToken)
        {
            await _accountLifecycleService.ResetPasswordAsync(
                request.Token,
                request.NewPassword,
                cancellationToken);
            ClearRefreshTokenCookie();
            ClearAssetAccessTokenCookie();
            return NoContent();
        }

        [Authorize]
        [HttpPut("account/login")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<AccountChangeResponse>> ChangeLogin(
            [FromBody] ChangeLoginRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var response = await _accountLifecycleService.ChangeLoginAsync(
                userId.Value,
                request,
                cancellationToken);
            ClearRefreshTokenCookie();
            ClearAssetAccessTokenCookie();
            return Ok(response);
        }

        [Authorize]
        [HttpPost("account/email/change")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<ActionResult<AcceptedAccountActionResponse>> ChangeEmail(
            [FromBody] ChangeEmailRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            await _accountLifecycleService.QueueEmailChangeAsync(
                userId.Value,
                request,
                cancellationToken);
            return Accepted(CreateAcceptedResponse());
        }

        [Authorize]
        [HttpPost("account/password/change")]
        [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
        public async Task<IActionResult> ChangePassword(
            [FromBody] ChangePasswordRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            await _accountLifecycleService.ChangePasswordAsync(
                userId.Value,
                request,
                cancellationToken);
            ClearRefreshTokenCookie();
            ClearAssetAccessTokenCookie();
            return NoContent();
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
            var currentDeviceSessionId = GetCurrentDeviceSessionId();

            if (userId == null || currentDeviceSessionId == null)
            {
                return Unauthorized();
            }

            if (id == currentDeviceSessionId.Value)
            {
                return BadRequest(new
                {
                    message = "The current device session cannot be revoked from the session list."
                });
            }

            var isRevoked = await _deviceSessionService.RevokeSessionAsync(
                userId.Value,
                id,
                currentDeviceSessionId.Value,
                cancellationToken);

            if (!isRevoked)
            {
                return NotFound();
            }

            return NoContent();
        }

        [Authorize]
        [HttpPost("sessions/revoke-others")]
        public async Task<IActionResult> RevokeOtherSessions(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            var currentDeviceSessionId = GetCurrentDeviceSessionId();

            if (userId == null || currentDeviceSessionId == null)
            {
                return Unauthorized();
            }

            await _deviceSessionService.RevokeOtherSessionsAsync(
                userId.Value,
                currentDeviceSessionId.Value,
                cancellationToken);

            return NoContent();
        }

        [Authorize]
        [HttpPost("sessions/revoke-all")]
        public async Task<IActionResult> RevokeAllSessions(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            await _deviceSessionService.RevokeAllSessionsAsync(
                userId.Value,
                cancellationToken);
            ClearRefreshTokenCookie();
            ClearAssetAccessTokenCookie();
            return NoContent();
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue("userId");

            return Guid.TryParse(userIdValue, out var userId)
                ? userId
                : null;
        }

        private static AcceptedAccountActionResponse CreateAcceptedResponse() =>
            new("If the account is eligible, an email with the next steps will be sent.");

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
