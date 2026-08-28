using ArcaneLink.Exceptions.ServerExceptions.Abstractions;

namespace ArcaneLink.Exceptions.ServerExceptions;

public class ServerOwnerCannotBeRemovedException : ServerException
{
    public ServerOwnerCannotBeRemovedException()
        : base(ExceptionMessages.ServerOwnerCannotBeRemoved)
    {
    }
}
