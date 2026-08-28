namespace ArcaneLink.Services.Validators;

public class PasswordValidationResult
{
    public PasswordValidationResult(IReadOnlyList<PasswordValidationError> errors)
    {
        this.Errors = errors;
    }

    public bool IsValid => this.Errors.Count == 0;

    public IReadOnlyList<PasswordValidationError> Errors { get; }
}

public class PasswordValidationError
{
    public PasswordValidationError(string code, string message)
    {
        this.Code = code;
        this.Message = message;
    }

    public string Code { get; }

    public string Message { get; }
}
