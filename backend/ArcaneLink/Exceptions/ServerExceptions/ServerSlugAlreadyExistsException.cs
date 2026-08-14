using ArcaneLink.Exceptions.ServerExceptions.Abstractions;

namespace ArcaneLink.Exceptions.ServerExceptions
{
    public class ServerSlugAlreadyExistsException : ServerException
    {
        public ServerSlugAlreadyExistsException()
            : base(ExceptionMessages.ServerSlugAlreadyExists)
        {
        }
    }
}
