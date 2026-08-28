using ArcaneLink.Exceptions.UserExceptions.Abstractions;

namespace ArcaneLink.Exceptions.UsersExceptions;

// Исключение для некорректных данных профиля пользователя.
//
// Например:
// - displayName пустой после Trim()
// - update-запрос не содержит изменений
// - websiteUrl не является http/https URL
public class InvalidUserProfileDataException : UserException
{
    public InvalidUserProfileDataException()
        : base(ExceptionMessages.InvalidProfileData)
    {
    }

    public InvalidUserProfileDataException(string message)
        : base(message)
    {
    }
}
