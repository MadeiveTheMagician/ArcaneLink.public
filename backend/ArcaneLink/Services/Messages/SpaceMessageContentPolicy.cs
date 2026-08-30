using System.Text;
using System.Text.RegularExpressions;

namespace ArcaneLink.Services.Messages;

internal static partial class SpaceMessageContentPolicy
{
    public static bool ContainsExternalLink(string? body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            return false;
        }

        string normalized;
        try
        {
            normalized = body.Normalize(NormalizationForm.FormKC);
        }
        catch (ArgumentException)
        {
            // Invalid Unicode is rejected conservatively by the link permission gate.
            return true;
        }

        return UriSchemeRegex().IsMatch(normalized) ||
               DomainRegex().IsMatch(normalized);
    }

    [GeneratedRegex(
        @"(?<![\p{L}\p{N}_])(?:[a-z][a-z0-9+.-]{1,31}):(?://|[^\s])",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex UriSchemeRegex();

    [GeneratedRegex(
        @"(?<![@\p{L}\p{N}_.-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})(?::\d{1,5})?(?:[/#?][^\s]*)?",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DomainRegex();
}
