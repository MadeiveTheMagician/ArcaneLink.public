using ArcaneLink.Exceptions.AuthExceptions.Abstractions;

namespace ArcaneLink.Exceptions.AuthExceptions
{
    public class RefreshTokenGenerationFailedException : AuthSystemException
    {
        public RefreshTokenGenerationFailedException()
            : base(ExceptionMessages.RefreshTokenGenerationFailed)
        {
        }
    }
}