namespace ArcaneLink.DataBase.Constants
{
    public static class MessageDisplayFormatCodes
    {
        public const string WallScroll = "wall-scroll";
        public const string Bubble = "bubble";

        public static string? Normalize(string? value)
        {
            return value?.Trim().ToLowerInvariant() switch
            {
                WallScroll => WallScroll,
                Bubble => Bubble,
                _ => null
            };
        }
    }
}
