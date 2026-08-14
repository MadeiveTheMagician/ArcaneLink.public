namespace ArcaneLink.Services.PrivateSpaces
{
    public static class PrivateSpaceTitleMapper
    {
        public const int MaxTitleLength = 128;
        public const int VisibleDefaultGroupMemberCount = 3;

        private const string EmptyGroupTitle = "Новая группа";
        private const string GroupTitlePrefix = "Группа пользователей ";
        private const string MoreMembersSuffix = " и др.";

        public static string BuildDefaultGroupTitle(
            IEnumerable<string?> orderedDisplayNames)
        {
            var names = orderedDisplayNames
                .Select(name => name?.Trim())
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Take(VisibleDefaultGroupMemberCount + 1)
                .Cast<string>()
                .ToArray();

            if (names.Length == 0)
            {
                return EmptyGroupTitle;
            }

            var hasMoreMembers =
                names.Length > VisibleDefaultGroupMemberCount;
            var visibleNames = names.Take(VisibleDefaultGroupMemberCount);
            var suffix = hasMoreMembers ? MoreMembersSuffix : string.Empty;
            var title =
                $"{GroupTitlePrefix}{string.Join(", ", visibleNames)}{suffix}";
            if (title.Length <= MaxTitleLength)
            {
                return title;
            }

            var contentLength = Math.Max(
                GroupTitlePrefix.Length,
                MaxTitleLength - suffix.Length);
            var compactTitle = title[..contentLength]
                .TrimEnd(' ', ',');
            return $"{compactTitle}{suffix}";
        }
    }
}
