namespace ArcaneLink.DataBase.Constants
{
    public static class MessageBubbleAlignmentCodes
    {
        public const string OneSideLeft = "one-side-left";
        public const string OneSideRight = "one-side-right";
        public const string OwnLeft = "own-left";
        public const string OwnRight = "own-right";

        public static string? Normalize(string? value)
        {
            return value?.Trim().ToLowerInvariant() switch
            {
                OneSideLeft => OneSideLeft,
                OneSideRight => OneSideRight,
                OwnLeft => OwnLeft,
                OwnRight => OwnRight,
                _ => null
            };
        }
    }
}
