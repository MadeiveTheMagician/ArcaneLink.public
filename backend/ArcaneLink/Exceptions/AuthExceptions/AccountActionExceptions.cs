using ArcaneLink.Exceptions.AuthExceptions.Abstractions;

namespace ArcaneLink.Exceptions.AuthExceptions;

public sealed class InvalidAccountActionTokenException : AuthSystemException
{
    public InvalidAccountActionTokenException() : base("This account action link is invalid or has expired.") { }
}

public sealed class EmailNotConfirmedException : Exception
{
    public EmailNotConfirmedException() : base("Confirm your email address before signing in.") { }
}

public sealed class InvalidCurrentPasswordException : Exception
{
    public InvalidCurrentPasswordException() : base("Current password is incorrect.") { }
}
