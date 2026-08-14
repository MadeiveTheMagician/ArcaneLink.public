namespace ArcaneLink.DataBase.Constants
{
    public static class MessageBubbleWidthCodes
    {
        public const string Standard = "standard";
        public const string FullWidth = "full-width";

        public static string? Normalize(string? value)
        {
            return value?.Trim().ToLowerInvariant() switch
            {
                Standard => Standard,
                FullWidth => FullWidth,
                _ => null
            };
        }
    }
}
