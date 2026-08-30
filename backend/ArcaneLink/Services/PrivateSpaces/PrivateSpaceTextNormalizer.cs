namespace ArcaneLink.Services.PrivateSpaces;

internal static class PrivateSpaceTextNormalizer
{
    internal static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
