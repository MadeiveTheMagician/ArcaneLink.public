using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.UserExceptions.Abstractions;
using ArcaneLink.Services.Validators;

namespace ArcaneLink.Exceptions.UsersExceptions
{
    // Исключение для некорректных данных регистрации.
    //
    // Например:
    // - login состоит только из пробелов
    // - email пустой после Trim()
    // - displayName пустой после Trim()
    public class InvalidUserRegistrationDataException : UserException
    {
        public InvalidUserRegistrationDataException()
            : base(ExceptionMessages.InvalidRegistrationData)
        {
        }

        public InvalidUserRegistrationDataException(string message)
            : base(message)
        {
        }

        public InvalidUserRegistrationDataException(
            string message,
            IReadOnlyList<PasswordValidationError> errors)
            : base(message)
        {
            this.Errors = errors;
        }

        public IReadOnlyList<PasswordValidationError> Errors { get; } =
            Array.Empty<PasswordValidationError>();
    }
}
