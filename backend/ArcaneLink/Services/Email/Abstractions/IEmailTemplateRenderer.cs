using ArcaneLink.Services.Email;

namespace ArcaneLink.Services.Email.Abstractions;

public interface IEmailTemplateRenderer
{
    RenderedEmailTemplate Render(
        string templateName,
        IReadOnlyDictionary<string, string>? variables = null);
}
