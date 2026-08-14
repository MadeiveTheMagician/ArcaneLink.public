namespace ArcaneLink.Exceptions.ServerExceptions.Abstractions
{
    public abstract class ServerException : Exception
    {
        protected ServerException(string message)
            : base(message)
        {
        }
    }
}
