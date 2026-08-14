using ArcaneLink.Exceptions.UserExceptions.Abstractions;

namespace ArcaneLink.Exceptions.UsersExceptions
{
    public sealed class DirectMessagePrivacyDeniedException : UserException
    {
        public DirectMessagePrivacyDeniedException()
            : base(ExceptionMessages.DirectMessagePrivacyDenied)
        {
        }
    }
}
