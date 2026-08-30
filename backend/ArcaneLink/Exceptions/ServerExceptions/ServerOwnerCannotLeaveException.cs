using ArcaneLink.Exceptions.ServerExceptions.Abstractions;

namespace ArcaneLink.Exceptions.ServerExceptions;

public class ServerOwnerCannotLeaveException : ServerException
{
    public ServerOwnerCannotLeaveException()
        : base(ExceptionMessages.ServerOwnerCannotLeave)
    {
    }
}
