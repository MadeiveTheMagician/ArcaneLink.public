namespace ArcaneLink.Services.Spaces;

internal static class SpaceTextNormalizer
{
    public static string NormalizeCode(string value) => value.Trim().ToLowerInvariant();

    public static string NormalizeTitle(string value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? throw new ArgumentException("Title is required.")
            : value.Trim();
    }

    public static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}
