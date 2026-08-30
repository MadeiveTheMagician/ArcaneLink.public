using ArcaneLink.Exceptions.AuthExceptions.Abstractions;

namespace ArcaneLink.Exceptions.AuthExceptions;

public class InvalidRefreshTokenException : AuthSystemException
{
    public InvalidRefreshTokenException()
        : base(ExceptionMessages.InvalidRefreshToken)
    {

    }
}
