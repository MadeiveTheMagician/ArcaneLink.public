namespace ArcaneLink.Services.Email;

public static class EmailTemplateNames
{
    public const string EmailVerification = "email-verification";
    public const string PasswordReset = "password-reset";
    public const string EmailChange = "email-change";
    public const string EmailChangedSecurityNotice =
        "email-changed-security-notice";

    public static IReadOnlyList<string> All { get; } =
    [
        EmailVerification,
        PasswordReset,
        EmailChange,
        EmailChangedSecurityNotice
    ];

    public static IReadOnlySet<string> GetRequiredVariables(string templateName) =>
        templateName switch
        {
            EmailVerification => VerificationVariables,
            PasswordReset => PasswordResetVariables,
            EmailChange => EmailChangeVariables,
            EmailChangedSecurityNotice => NoVariables,
            _ => throw new InvalidOperationException(
                $"Unknown email template '{templateName}'.")
        };

    private static IReadOnlySet<string> VerificationVariables { get; } =
        new HashSet<string>(StringComparer.Ordinal)
        {
            "link",
            "lifetime_hours"
        };

    private static IReadOnlySet<string> PasswordResetVariables { get; } =
        new HashSet<string>(StringComparer.Ordinal)
        {
            "link",
            "lifetime_minutes"
        };

    private static IReadOnlySet<string> EmailChangeVariables { get; } =
        VerificationVariables;

    private static IReadOnlySet<string> NoVariables { get; } =
        new HashSet<string>(StringComparer.Ordinal);
}
