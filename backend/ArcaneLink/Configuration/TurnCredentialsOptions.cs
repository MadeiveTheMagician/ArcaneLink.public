namespace ArcaneLink.Configuration;

public sealed class TurnCredentialsOptions
{
    public const string SectionName = "TurnCredentials";
    public const int MinimumTtlSeconds = 60;
    public const int MaximumTtlSeconds = 3600;

    public bool Enabled { get; set; }
    public string SharedSecret { get; set; } = string.Empty;
    public int TtlSeconds { get; set; } = 600;
    public string[] Urls { get; set; } = [];

    public bool HasValidConfiguration()
    {
        return TryValidate(requireEnabled: false, out _);
    }

    public bool TryValidate(bool requireEnabled, out string error)
    {
        if (!Enabled)
        {
            error = requireEnabled
                ? $"{SectionName}:Enabled must be true."
                : string.Empty;
            return !requireEnabled;
        }

        if (string.IsNullOrWhiteSpace(SharedSecret) ||
            ContainsPlaceholderMarker(SharedSecret) ||
            SharedSecret.Length < 32)
        {
            error = $"{SectionName}:SharedSecret must contain at least 32 non-placeholder characters.";
            return false;
        }

        if (TtlSeconds is < MinimumTtlSeconds or > MaximumTtlSeconds)
        {
            error = $"{SectionName}:TtlSeconds must be between {MinimumTtlSeconds} and {MaximumTtlSeconds}.";
            return false;
        }

        if (Urls is not { Length: > 0 } || Urls.Any(url => !IsTurnUrl(url)))
        {
            error = $"{SectionName}:Urls must contain only non-empty turn: or turns: URLs.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static bool IsTurnUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            value.Any(char.IsControl) ||
            value.Any(char.IsWhiteSpace))
        {
            return false;
        }

        var separatorIndex = value.IndexOf(':');
        if (separatorIndex <= 0 || separatorIndex == value.Length - 1)
        {
            return false;
        }

        var scheme = value[..separatorIndex];
        return scheme.Equals("turn", StringComparison.OrdinalIgnoreCase) ||
               scheme.Equals("turns", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ContainsPlaceholderMarker(string value)
    {
        return value.Contains("replace-with", StringComparison.OrdinalIgnoreCase) ||
               value.Contains("change-me", StringComparison.OrdinalIgnoreCase);
    }
}
