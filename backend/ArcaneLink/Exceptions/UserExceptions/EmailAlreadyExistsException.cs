using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.UserExceptions.Abstractions;

namespace ArcaneLink.Exceptions.UsersExceptions;

// Исключение, выбрасываемое,
// если email уже существует в системе

public class EmailAlreadyExistsException : UserException
{
    // Передаём сообщение в базовый класс
    public EmailAlreadyExistsException()
        : base(ExceptionMessages.EmailAlreadyExists)
    {
    }
}
