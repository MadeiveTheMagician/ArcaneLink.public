using ArcaneLink.Exceptions.AuthExceptions.Abstractions;

namespace ArcaneLink.Exceptions.AuthExceptions;

public class UserWasBannedException : AuthSystemException
{
    public UserWasBannedException() : base(ExceptionMessages.UserWasBanned)
    {

    }

}
