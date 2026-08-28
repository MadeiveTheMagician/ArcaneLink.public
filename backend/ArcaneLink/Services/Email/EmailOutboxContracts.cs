namespace ArcaneLink.Services.Email;

public sealed record OutboxEmail(
    string Recipient,
    string Subject,
    string TextBody,
    string HtmlBody);

internal sealed record EmailLookupPayload(string Lookup);
