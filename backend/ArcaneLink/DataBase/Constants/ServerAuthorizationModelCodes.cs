namespace ArcaneLink.DataBase.Constants
{
    public static class ServerRoleKindCodes
    {
        public const string Standard = "standard";
        public const string Everyone = "everyone";
        public const string Integration = "integration";

        public static IReadOnlySet<string> All { get; } =
            new HashSet<string>(StringComparer.Ordinal)
            {
                Standard,
                Everyone,
                Integration
            };
    }

    public static class ServerMemberDisplayColorModeCodes
    {
        public const string Auto = "auto";
        public const string Default = "default";
        public const string Role = "role";

        public static IReadOnlySet<string> All { get; } =
            new HashSet<string>(StringComparer.Ordinal)
            {
                Auto,
                Default,
                Role
            };
    }
}
