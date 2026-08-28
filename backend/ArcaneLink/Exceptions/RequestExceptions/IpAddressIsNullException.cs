using ArcaneLink.Exceptions.RequestExceptions.Abstractions;

namespace ArcaneLink.Exceptions.RequestExceptions
{
    public class IpAddressIsNullException : RequestException
    {
        public IpAddressIsNullException() : base(ExceptionMessages.IpAddressIsNull)
        {

        }
    }
}
