namespace ArcaneLink.Exceptions.UserExceptions.Abstractions;

// Базовое исключение пользовательского модуля.
//
// Все пользовательские ошибки наследуются от него.
//
// Это позволяет:
// 1. Ловить все пользовательские ошибки одним catch
// 2. Отделять пользовательские ошибки от системных
// 3. Масштабировать систему ошибок

public abstract class UserException : Exception
{
    // Базовый конструктор принимает сообщение ошибки
    protected UserException(string message)
        : base(message)
    {
    }
}
