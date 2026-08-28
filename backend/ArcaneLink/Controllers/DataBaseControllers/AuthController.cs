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

namespace ArcaneLink.Controllers.DataBaseControllers;

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
        this._registrationService = registrationService;
        this._loginService = loginService;
        this._authTokenService = authTokenService;
        this._logoutService = logoutService;
        this._deviceSessionService = deviceSessionService;
        this._accountLifecycleService = accountLifecycleService;
    }

    [HttpPost("register")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<UserResponse>> Register(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var response = await this._registrationService.RegisterAsync(
            request,
            cancellationToken);

        return this.Ok(response);
    }

    [HttpPost("login")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var response = await this._loginService.LoginAsync(
            request,
            cancellationToken);

        this.SetRefreshTokenCookie(
            response.RefreshToken,
            response.RefreshTokenExpireAt);
        this.SetAssetAccessTokenCookie(
            response.AccessToken,
            response.AccessTokenExpireAt);

        return this.Ok(response);
    }

    [HttpPost("email/resend")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<AcceptedAccountActionResponse>> ResendEmailVerification(
        [FromBody] ResendVerificationEmailRequest request,
        CancellationToken cancellationToken)
    {
        await this._accountLifecycleService.QueueVerificationResendAsync(
            request.Email,
            cancellationToken);
        return this.Accepted(CreateAcceptedResponse());
    }

    [HttpPost("email/confirm")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<ConfirmEmailResponse>> ConfirmEmail(
        [FromBody] EmailTokenRequest request,
        CancellationToken cancellationToken)
    {
        return this.Ok(await this._accountLifecycleService.ConfirmEmailAsync(
            request.Token,
            cancellationToken));
    }

    [HttpPost("password/forgot")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<AcceptedAccountActionResponse>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await this._accountLifecycleService.QueuePasswordResetAsync(
            request.LoginOrEmail,
            cancellationToken);
        return this.Accepted(CreateAcceptedResponse());
    }

    [HttpPost("password/reset")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await this._accountLifecycleService.ResetPasswordAsync(
            request.Token,
            request.NewPassword,
            cancellationToken);
        this.ClearRefreshTokenCookie();
        this.ClearAssetAccessTokenCookie();
        return this.NoContent();
    }

    [Authorize]
    [HttpPut("account/login")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<AccountChangeResponse>> ChangeLogin(
        [FromBody] ChangeLoginRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        var response = await this._accountLifecycleService.ChangeLoginAsync(
            userId.Value,
            request,
            cancellationToken);
        this.ClearRefreshTokenCookie();
        this.ClearAssetAccessTokenCookie();
        return this.Ok(response);
    }

    [Authorize]
    [HttpPost("account/email/change")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<AcceptedAccountActionResponse>> ChangeEmail(
        [FromBody] ChangeEmailRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        await this._accountLifecycleService.QueueEmailChangeAsync(
            userId.Value,
            request,
            cancellationToken);
        return this.Accepted(CreateAcceptedResponse());
    }

    [Authorize]
    [HttpPost("account/password/change")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        await this._accountLifecycleService.ChangePasswordAsync(
            userId.Value,
            request,
            cancellationToken);
        this.ClearRefreshTokenCookie();
        this.ClearAssetAccessTokenCookie();
        return this.NoContent();
    }

    [HttpPost("refresh")]
    [EnableRateLimiting(AbuseRateLimitPolicyNames.Auth)]
    public async Task<ActionResult<AuthTokenPair>> Refresh(
        [FromBody] RefreshTokenRequest? request,
        CancellationToken cancellationToken)
    {
        var refreshToken = this.ResolveRefreshToken(request);
        var response = await this._authTokenService.RefreshTokenAsync(
            new RefreshTokenRequest { RefreshToken = refreshToken },
            cancellationToken);

        this.SetRefreshTokenCookie(
            response.RefreshToken,
            response.RefreshTokenExpiresAt);
        this.SetAssetAccessTokenCookie(
            response.AccessToken,
            response.AccessTokenExpiresAt);

        return this.Ok(response);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        [FromBody] LogoutRequest? request,
        CancellationToken cancellationToken)
    {
        await this._logoutService.LogoutAsync(
            new LogoutRequest { RefreshToken = this.ResolveRefreshToken(request) },
            cancellationToken);
        this.ClearRefreshTokenCookie();
        this.ClearAssetAccessTokenCookie();
        return this.NoContent();
    }

    [Authorize]
    [HttpPost("logoutAll")]
    public async Task<IActionResult> LogoutAll(CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();

        if (userId == null)
        {
            return this.Unauthorized();
        }

        await this._logoutService.LogoutAllAsync(
            userId.Value,
            cancellationToken);

        this.ClearRefreshTokenCookie();
        this.ClearAssetAccessTokenCookie();
        return this.NoContent();
    }

    [Authorize]
    [HttpGet("sessions")]
    public async Task<ActionResult<IReadOnlyList<UserDeviceSessionResponse>>> GetSessions(
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();

        if (userId == null)
        {
            return this.Unauthorized();
        }

        var sessions = await this._deviceSessionService.GetActiveSessionsAsync(
            userId.Value,
            this.GetCurrentDeviceSessionId(),
            cancellationToken);

        return this.Ok(sessions);
    }

    [Authorize]
    [HttpPost("sessions/{id:guid}/revoke")]
    public async Task<IActionResult> RevokeSession(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        var currentDeviceSessionId = this.GetCurrentDeviceSessionId();

        if (userId == null || currentDeviceSessionId == null)
        {
            return this.Unauthorized();
        }

        if (id == currentDeviceSessionId.Value)
        {
            return this.BadRequest(new
            {
                message = "The current device session cannot be revoked from the session list."
            });
        }

        var isRevoked = await this._deviceSessionService.RevokeSessionAsync(
            userId.Value,
            id,
            currentDeviceSessionId.Value,
            cancellationToken);

        if (!isRevoked)
        {
            return this.NotFound();
        }

        return this.NoContent();
    }

    [Authorize]
    [HttpPost("sessions/revoke-others")]
    public async Task<IActionResult> RevokeOtherSessions(
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        var currentDeviceSessionId = this.GetCurrentDeviceSessionId();

        if (userId == null || currentDeviceSessionId == null)
        {
            return this.Unauthorized();
        }

        await this._deviceSessionService.RevokeOtherSessionsAsync(
            userId.Value,
            currentDeviceSessionId.Value,
            cancellationToken);

        return this.NoContent();
    }

    [Authorize]
    [HttpPost("sessions/revoke-all")]
    public async Task<IActionResult> RevokeAllSessions(
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        await this._deviceSessionService.RevokeAllSessionsAsync(
            userId.Value,
            cancellationToken);
        this.ClearRefreshTokenCookie();
        this.ClearAssetAccessTokenCookie();
        return this.NoContent();
    }

    private Guid? GetCurrentUserId()
    {
        var userIdValue = this.User.FindFirstValue("userId");

        return Guid.TryParse(userIdValue, out var userId)
            ? userId
            : null;
    }

    private static AcceptedAccountActionResponse CreateAcceptedResponse() =>
        new("If the account is eligible, an email with the next steps will be sent.");

    private Guid? GetCurrentDeviceSessionId()
    {
        var deviceSessionIdValue = this.User.FindFirstValue("deviceSessionId");

        return Guid.TryParse(deviceSessionIdValue, out var deviceSessionId)
            ? deviceSessionId
            : null;
    }

    private string? ResolveRefreshToken(RefreshTokenRequest? request)
    {
        return !string.IsNullOrWhiteSpace(request?.RefreshToken)
            ? request.RefreshToken
            : this.Request.Cookies[AuthCookieNames.RefreshToken];
    }

    private string? ResolveRefreshToken(LogoutRequest? request)
    {
        return !string.IsNullOrWhiteSpace(request?.RefreshToken)
            ? request.RefreshToken
            : this.Request.Cookies[AuthCookieNames.RefreshToken];
    }

    private void SetRefreshTokenCookie(string refreshToken, DateTime expiresAt)
    {
        this.Response.Cookies.Append(
            AuthCookieNames.RefreshToken,
            refreshToken,
            this.CreateRefreshTokenCookieOptions(expiresAt));
    }

    private void ClearRefreshTokenCookie()
    {
        this.Response.Cookies.Delete(
            AuthCookieNames.RefreshToken,
            this.CreateRefreshTokenCookieOptions(DateTimeOffset.UtcNow.AddDays(-1)));
    }

    private void SetAssetAccessTokenCookie(
        string accessToken,
        DateTime expiresAt)
    {
        this.Response.Cookies.Append(
            AuthCookieNames.AssetAccessToken,
            accessToken,
            this.CreateAssetAccessTokenCookieOptions(expiresAt));
    }

    private void ClearAssetAccessTokenCookie()
    {
        this.Response.Cookies.Delete(
            AuthCookieNames.AssetAccessToken,
            this.CreateAssetAccessTokenCookieOptions(DateTimeOffset.UtcNow.AddDays(-1)));
    }

    private CookieOptions CreateRefreshTokenCookieOptions(DateTimeOffset expiresAt)
    {
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = this.Request.IsHttps,
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
            Secure = this.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/api/assets",
            Expires = expiresAt
        };
    }
}
