using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using BclIPNetwork = System.Net.IPNetwork;

namespace ArcaneLink.Configuration;

public sealed class TrustedForwardedHeadersOptions
{
    public const string SectionName = "ForwardedHeaders";

    public bool Enabled { get; set; } = true;

    public int ForwardLimit { get; set; } = 1;

    public bool RequireHeaderSymmetry { get; set; } = true;

    public List<string> KnownProxies { get; set; } = [];

    public List<string> KnownNetworks { get; set; } = [];

    public static bool TryValidate(
        TrustedForwardedHeadersOptions options,
        bool requireTrustedSource,
        out string? error)
    {
        if (!options.Enabled)
        {
            error = requireTrustedSource
                ? "ForwardedHeaders:Enabled must be true in production."
                : null;
            return !requireTrustedSource;
        }

        if (options.ForwardLimit < 1 || options.ForwardLimit > 5)
        {
            error = "ForwardedHeaders:ForwardLimit must be between 1 and 5.";
            return false;
        }

        if (requireTrustedSource && !options.RequireHeaderSymmetry)
        {
            error = "ForwardedHeaders:RequireHeaderSymmetry must be true in production.";
            return false;
        }

        if (requireTrustedSource &&
            options.KnownProxies.Count == 0 &&
            options.KnownNetworks.Count == 0)
        {
            error = "Production forwarded headers require at least one known proxy or network.";
            return false;
        }

        foreach (var value in options.KnownProxies)
        {
            if (!IPAddress.TryParse(value, out var address))
            {
                error = $"ForwardedHeaders:KnownProxies contains an invalid IP address: '{value}'.";
                return false;
            }

            if (address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any))
            {
                error = "ForwardedHeaders:KnownProxies must not trust an unspecified address.";
                return false;
            }
        }

        foreach (var value in options.KnownNetworks)
        {
            if (!BclIPNetwork.TryParse(value, out var network))
            {
                error = $"ForwardedHeaders:KnownNetworks contains an invalid CIDR: '{value}'.";
                return false;
            }

            if (network.PrefixLength == 0)
            {
                error = "ForwardedHeaders:KnownNetworks must not trust a global /0 network.";
                return false;
            }
        }

        error = null;
        return true;
    }

    public void ApplyTo(ForwardedHeadersOptions target)
    {
        if (!TryValidate(this, requireTrustedSource: false, out var error))
        {
            throw new InvalidOperationException(error);
        }

        target.ForwardedHeaders = Enabled
            ? ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
            : ForwardedHeaders.None;
        target.ForwardLimit = ForwardLimit;
        target.RequireHeaderSymmetry = RequireHeaderSymmetry;
        target.KnownProxies.Clear();
        target.KnownIPNetworks.Clear();

        foreach (var value in KnownProxies)
        {
            target.KnownProxies.Add(IPAddress.Parse(value));
        }

        foreach (var value in KnownNetworks)
        {
            target.KnownIPNetworks.Add(BclIPNetwork.Parse(value));
        }
    }
}
