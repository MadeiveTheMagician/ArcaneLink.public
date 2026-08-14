using ArcaneLink.Exceptions.RequestExceptions.Abstractions;

namespace ArcaneLink.Exceptions.RequestExceptions
{
    public class UserAgentIsNullException : RequestException
    {
        public UserAgentIsNullException():base(ExceptionMessages.UserAgentIsNull)
        {

        }
    }
}   