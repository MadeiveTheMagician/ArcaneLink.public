using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Auth;

public sealed class EmailTokenRequest
{
    [Required, MaxLength(512)]
    public string Token { get; set; } = null!;
}

public sealed class ResendVerificationEmailRequest
{
    [Required, EmailAddress, MaxLength(254)]
    public string Email { get; set; } = null!;
}

public sealed class ForgotPasswordRequest
{
    [Required, MinLength(3), MaxLength(254)]
    public string LoginOrEmail { get; set; } = null!;
}

public sealed class ResetPasswordRequest
{
    [Required, MaxLength(512)]
    public string Token { get; set; } = null!;

    [Required, MaxLength(128)]
    public string NewPassword { get; set; } = null!;
}

public sealed class ChangeLoginRequest
{
    [Required, MinLength(3), MaxLength(50)]
    public string NewLogin { get; set; } = null!;

    [Required, MaxLength(128)]
    public string CurrentPassword { get; set; } = null!;
}

public sealed class ChangeEmailRequest
{
    [Required, EmailAddress, MaxLength(254)]
    public string NewEmail { get; set; } = null!;

    [Required, MaxLength(128)]
    public string CurrentPassword { get; set; } = null!;
}

public sealed class ChangePasswordRequest
{
    [Required, MaxLength(128)]
    public string CurrentPassword { get; set; } = null!;

    [Required, MaxLength(128)]
    public string NewPassword { get; set; } = null!;
}

public sealed record AcceptedAccountActionResponse(string Message);

public sealed record ConfirmEmailResponse(
    bool EmailConfirmed,
    bool EmailChanged,
    bool RequiresReauthentication);

public sealed record AccountChangeResponse(
    string Login,
    string Email,
    bool RequiresReauthentication);
