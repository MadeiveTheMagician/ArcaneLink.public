namespace ArcaneLink.Services.Servers.Authorization
{
    public enum ServerPermissionGroup
    {
        Access,
        Messaging,
        Voice,
        Members,
        Roles,
        Spaces,
        Server
    }

    public sealed record ServerPermissionDefinition(
        int Bit,
        string Code,
        ServerPermissionGroup Group);

    public static class ServerPermissionRegistry
    {
        public const int SchemaVersion = 1;
        public const string AdministratorCode = "ADMINISTRATOR";

        // When a permission is retired, its bit must be added here and never reused.
        private static readonly HashSet<int> Retired = [];

        private static readonly ServerPermissionDefinition[] Registered =
        [
            new(0, "VIEW_TEXT_SPACES", ServerPermissionGroup.Access),
            new(1, "VIEW_VOICE_SPACES", ServerPermissionGroup.Access),
            new(2, "READ_MESSAGE_HISTORY", ServerPermissionGroup.Access),
            new(3, "READ_VOICE_CHAT_HISTORY", ServerPermissionGroup.Access),

            new(4, "SEND_MESSAGES", ServerPermissionGroup.Messaging),
            new(5, "SEND_MESSAGES_IN_VOICE_CHAT", ServerPermissionGroup.Messaging),
            new(6, "SEND_LINKS", ServerPermissionGroup.Messaging),
            new(7, "ATTACH_FILES", ServerPermissionGroup.Messaging),
            new(8, "ADD_REACTIONS", ServerPermissionGroup.Messaging),
            new(9, "MENTION_EVERYONE", ServerPermissionGroup.Messaging),
            new(10, "MENTION_HERE", ServerPermissionGroup.Messaging),
            new(11, "MANAGE_PINS", ServerPermissionGroup.Messaging),
            new(12, "MANAGE_MESSAGES", ServerPermissionGroup.Messaging),

            new(13, "CONNECT_VOICE", ServerPermissionGroup.Voice),
            new(14, "SPEAK_IN_VOICE", ServerPermissionGroup.Voice),
            new(15, "USE_VIDEO", ServerPermissionGroup.Voice),
            new(16, "SHARE_SCREEN", ServerPermissionGroup.Voice),
            new(17, "MUTE_VOICE_MEMBERS", ServerPermissionGroup.Voice),
            new(18, "DEAFEN_VOICE_MEMBERS", ServerPermissionGroup.Voice),
            new(19, "MOVE_VOICE_MEMBERS", ServerPermissionGroup.Voice),
            new(20, "DISCONNECT_VOICE_MEMBERS", ServerPermissionGroup.Voice),

            new(21, "CHANGE_OWN_NICKNAME", ServerPermissionGroup.Members),
            new(22, "MANAGE_NICKNAMES", ServerPermissionGroup.Members),
            new(23, "APPROVE_JOIN_REQUESTS", ServerPermissionGroup.Members),
            new(24, "KICK_MEMBERS", ServerPermissionGroup.Members),
            new(25, "BAN_MEMBERS", ServerPermissionGroup.Members),
            new(26, "MANAGE_BANS", ServerPermissionGroup.Members),
            new(27, "TIMEOUT_MEMBERS", ServerPermissionGroup.Members),

            new(28, "MANAGE_ROLES", ServerPermissionGroup.Roles),
            new(29, "ASSIGN_ROLES", ServerPermissionGroup.Roles),
            new(30, "MANAGE_DEFAULT_PERMISSIONS", ServerPermissionGroup.Roles),
            new(31, AdministratorCode, ServerPermissionGroup.Roles),

            new(32, "MANAGE_SPACE_SETTINGS", ServerPermissionGroup.Spaces),
            new(33, "MANAGE_SPACE_ACCESS", ServerPermissionGroup.Spaces),
            new(34, "REORDER_SPACES_AND_CATEGORIES", ServerPermissionGroup.Spaces),
            new(35, "CREATE_PUBLIC_CATEGORIES", ServerPermissionGroup.Spaces),
            new(36, "CREATE_PUBLIC_TEXT_SPACES", ServerPermissionGroup.Spaces),
            new(37, "CREATE_PUBLIC_VOICE_SPACES", ServerPermissionGroup.Spaces),
            new(38, "CREATE_PRIVATE_CATEGORIES", ServerPermissionGroup.Spaces),
            new(39, "CREATE_PRIVATE_TEXT_SPACES", ServerPermissionGroup.Spaces),
            new(40, "CREATE_PRIVATE_VOICE_SPACES", ServerPermissionGroup.Spaces),
            new(41, "DELETE_CATEGORIES", ServerPermissionGroup.Spaces),
            new(42, "DELETE_TEXT_SPACES", ServerPermissionGroup.Spaces),
            new(43, "DELETE_VOICE_SPACES", ServerPermissionGroup.Spaces),

            new(44, "CREATE_INVITES", ServerPermissionGroup.Server),
            new(45, "VIEW_INVITE_LOG", ServerPermissionGroup.Server),
            new(46, "MANAGE_INVITES", ServerPermissionGroup.Server),
            new(47, "MANAGE_SERVER_PROFILE", ServerPermissionGroup.Server),
            new(48, "MANAGE_SERVER_SETTINGS", ServerPermissionGroup.Server),
            new(49, "VIEW_AUDIT_LOG", ServerPermissionGroup.Server),
            new(50, "MANAGE_REPORTS", ServerPermissionGroup.Server)
        ];

        private static readonly IReadOnlyDictionary<string, ServerPermissionDefinition>
            RegisteredByCode = Registered.ToDictionary(
                definition => definition.Code,
                StringComparer.Ordinal);

        static ServerPermissionRegistry()
        {
            if (Registered.Any(x =>
                    x.Bit < 0 ||
                    x.Bit >= PermissionMask256.BitCapacity) ||
                Registered.Select(x => x.Bit).Distinct().Count() != Registered.Length ||
                Registered.Select(x => x.Code).Distinct(StringComparer.Ordinal).Count() !=
                Registered.Length ||
                Registered.Any(x => Retired.Contains(x.Bit)))
            {
                throw new InvalidOperationException(
                    "The server permission registry contains invalid or reused entries.");
            }
        }

        public static IReadOnlyList<ServerPermissionDefinition> All { get; } =
            Array.AsReadOnly(Registered);

        public static IReadOnlySet<int> RetiredBits { get; } = Retired;

        public static ServerPermissionDefinition Administrator { get; } =
            GetRequired(AdministratorCode);

        public static PermissionMask256 KnownPermissionsMask { get; } =
            PermissionMask256.FromBits(Registered.Select(x => x.Bit));

        public static IReadOnlyList<string> DefaultEveryonePermissionCodes { get; } =
        [
            "VIEW_TEXT_SPACES",
            "VIEW_VOICE_SPACES",
            "READ_MESSAGE_HISTORY",
            "READ_VOICE_CHAT_HISTORY",
            "SEND_MESSAGES",
            "SEND_MESSAGES_IN_VOICE_CHAT",
            "SEND_LINKS",
            "ATTACH_FILES",
            "ADD_REACTIONS",
            "MENTION_EVERYONE",
            "MENTION_HERE",
            "CONNECT_VOICE",
            "SPEAK_IN_VOICE",
            "USE_VIDEO",
            "SHARE_SCREEN",
            "CHANGE_OWN_NICKNAME"
        ];

        public static PermissionMask256 DefaultEveryonePermissionsMask { get; } =
            CreateMask(DefaultEveryonePermissionCodes);

        public static bool TryGet(
            string code,
            out ServerPermissionDefinition definition)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                definition = null!;
                return false;
            }

            return RegisteredByCode.TryGetValue(code, out definition!);
        }

        public static ServerPermissionDefinition GetRequired(string code)
        {
            if (!TryGet(code, out var definition))
            {
                throw new KeyNotFoundException(
                    $"Permission code '{code}' is not registered in schema v{SchemaVersion}.");
            }

            return definition;
        }

        public static PermissionMask256 CreateMask(IEnumerable<string> codes)
        {
            ArgumentNullException.ThrowIfNull(codes);

            var mask = PermissionMask256.Empty;
            foreach (var code in codes)
            {
                mask = mask.With(GetRequired(code).Bit);
            }

            return mask;
        }

        public static IReadOnlyList<string> GetCodes(PermissionMask256 mask)
        {
            ValidateForWrite(mask, SchemaVersion);
            return Registered
                .Where(definition => mask.Contains(definition.Bit))
                .OrderBy(definition => definition.Bit)
                .Select(definition => definition.Code)
                .ToList();
        }

        public static PermissionMask256 ValidateForWrite(
            PermissionMask256 mask,
            int schemaVersion)
        {
            if (schemaVersion != SchemaVersion)
            {
                throw new InvalidOperationException(
                    $"Permission schema v{schemaVersion} cannot be written by schema v{SchemaVersion}.");
            }

            if (!mask.Except(KnownPermissionsMask).IsEmpty)
            {
                throw new InvalidOperationException(
                    "The permission mask contains unregistered or retired bits.");
            }

            return mask;
        }
    }
}
