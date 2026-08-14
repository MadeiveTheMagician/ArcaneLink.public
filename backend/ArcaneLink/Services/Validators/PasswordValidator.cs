using ArcaneLink.Services.Validators.Abstractions;

namespace ArcaneLink.Services.Validators
{
    public class PasswordValidator : IValidator<string?>
    {
        private const int MinLength = 8;
        private const int MaxLength = 128;

        public Task<bool> Validate(string? validatedObject)
        {
            return Task.FromResult(ValidatePassword(validatedObject).IsValid);
        }

        public Task<PasswordValidationResult> ValidateDetailedAsync(string? password)
        {
            return Task.FromResult(ValidatePassword(password));
        }

        private static PasswordValidationResult ValidatePassword(string? password)
        {
            var errors = new List<PasswordValidationError>();

            if (string.IsNullOrWhiteSpace(password))
            {
                errors.Add(new PasswordValidationError(
                    "PasswordRequired",
                    "Password is required."));

                return new PasswordValidationResult(errors);
            }

            if (password.Length < MinLength)
            {
                errors.Add(new PasswordValidationError(
                    "PasswordTooShort",
                    $"Password must be at least {MinLength} characters long."));
            }

            if (password.Length > MaxLength)
            {
                errors.Add(new PasswordValidationError(
                    "PasswordTooLong",
                    $"Password must be no longer than {MaxLength} characters."));
            }

            if (!password.Any(char.IsLower))
            {
                errors.Add(new PasswordValidationError(
                    "PasswordMissingLowercaseLetter",
                    "Password must contain at least one lowercase letter."));
            }

            if (!password.Any(char.IsUpper))
            {
                errors.Add(new PasswordValidationError(
                    "PasswordMissingUppercaseLetter",
                    "Password must contain at least one uppercase letter."));
            }

            if (!password.Any(char.IsDigit))
            {
                errors.Add(new PasswordValidationError(
                    "PasswordMissingDigit",
                    "Password must contain at least one digit."));
            }

            if (!password.Any(IsSpecialCharacter))
            {
                errors.Add(new PasswordValidationError(
                    "PasswordMissingSpecialCharacter",
                    "Password must contain at least one special character."));
            }

            if (password.Any(char.IsWhiteSpace))
            {
                errors.Add(new PasswordValidationError(
                    "PasswordContainsWhitespace",
                    "Password must not contain whitespace characters."));
            }

            return new PasswordValidationResult(errors);
        }

        private static bool IsSpecialCharacter(char character)
        {
            return !char.IsLetterOrDigit(character) && !char.IsWhiteSpace(character);
        }
    }
}
