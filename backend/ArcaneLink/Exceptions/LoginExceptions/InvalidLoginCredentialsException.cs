using ArcaneLink.Exceptions.LoginExceptions.Abstractions;

namespace ArcaneLink.Exceptions.LoginExceptions;

public class InvalidLoginCredentialsException : LoginSystemException
{
    public InvalidLoginCredentialsException()
        : base(ExceptionMessages.NonexistentPasswordCredentials)
    {
    }
}

