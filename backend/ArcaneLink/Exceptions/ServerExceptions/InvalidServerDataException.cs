using ArcaneLink.Exceptions.ServerExceptions.Abstractions;

namespace ArcaneLink.Exceptions.ServerExceptions;

public class InvalidServerDataException : ServerException
{
    public InvalidServerDataException()
        : base(ExceptionMessages.InvalidServerData)
    {
    }

    public InvalidServerDataException(string message)
        : base(message)
    {
    }
}
