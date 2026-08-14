namespace ArcaneLink.Services.Validators
{
    public class PasswordValidationResult
    {
        public PasswordValidationResult(IReadOnlyList<PasswordValidationError> errors)
        {
            Errors = errors;
        }

        public bool IsValid => Errors.Count == 0;

        public IReadOnlyList<PasswordValidationError> Errors { get; }
    }

    public class PasswordValidationError
    {
        public PasswordValidationError(string code, string message)
        {
            Code = code;
            Message = message;
        }

        public string Code { get; }

        public string Message { get; }
    }
}
