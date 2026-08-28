namespace ArcaneLink.Services.Email;

public sealed record RenderedEmailTemplate(
    string Subject,
    string TextBody,
    string HtmlBody);

internal sealed class EmailTemplateDocument
{
    public string Subject { get; init; } = string.Empty;
    public string TextBody { get; init; } = string.Empty;
    public string HtmlBody { get; init; } = string.Empty;
}
