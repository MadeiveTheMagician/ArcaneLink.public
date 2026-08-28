using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.UserExceptions.Abstractions;

namespace ArcaneLink.Exceptions.UsersExceptions
{
    // Исключение, выбрасываемое,
    // если логин уже существует в системе

    public class LoginAlreadyExistsException : UserException
    {
        // Передаём сообщение в базовый класс
        public LoginAlreadyExistsException()
            : base(ExceptionMessages.LoginAlreadyExists)
        {
        }
    }
}
