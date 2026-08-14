namespace ArcaneLink.Exceptions.AuthExceptions.Abstractions
{
    public abstract class AuthSystemException : Exception
    {
        protected AuthSystemException(string message)
            : base(message)
        {
        }
    }
}
