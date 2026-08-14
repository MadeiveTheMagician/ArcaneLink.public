namespace ArcaneLink.Exceptions.LoginExceptions.Abstractions;

public abstract class LoginSystemException : Exception
{
    protected LoginSystemException(string message)
        : base(message)
    {
    }
}

