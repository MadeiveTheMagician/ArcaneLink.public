namespace ArcaneLink.Exceptions.AssetExceptions.Abstractions
{
    // Базовое исключение asset-модуля.
    //
    // Позволяет middleware обрабатывать ошибки ассетов единым правилом,
    // не привязываясь к каждому конкретному классу исключения.
    public abstract class AssetException : Exception
    {
        protected AssetException(string message)
            : base(message)
        {
        }
    }
}
