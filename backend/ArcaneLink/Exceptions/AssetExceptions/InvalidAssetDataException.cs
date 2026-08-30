using ArcaneLink.Exceptions.AssetExceptions.Abstractions;

namespace ArcaneLink.Exceptions.AssetExceptions;

public class InvalidAssetDataException : AssetException
{
    public InvalidAssetDataException()
        : base(ExceptionMessages.InvalidAssetData)
    {
    }

    public InvalidAssetDataException(string message)
        : base(message)
    {
    }
}
