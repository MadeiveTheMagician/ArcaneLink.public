namespace ArcaneLink.Exceptions.RequestExceptions.Abstractions
{
    public abstract class RequestException : Exception
    {
        public RequestException(string message) : base(message)
        {

        }
    }
}
