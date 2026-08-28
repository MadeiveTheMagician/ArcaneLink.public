using ArcaneLink.Exceptions.ServerExceptions.Abstractions;

namespace ArcaneLink.Exceptions.ServerExceptions;

public class ServerOwnerCannotBeBannedException : ServerException
{
    public ServerOwnerCannotBeBannedException()
        : base(ExceptionMessages.ServerOwnerCannotBeBanned)
    {
    }
}
