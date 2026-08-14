using ArcaneLink.Exceptions.AssetExceptions.Abstractions;

namespace ArcaneLink.Exceptions.AssetExceptions
{
    public class AssetTypeDoesNotExistException : AssetException
    {
        public AssetTypeDoesNotExistException()
            : base(ExceptionMessages.AssetTypeDoesNotExist)
        {
        }
    }
}
