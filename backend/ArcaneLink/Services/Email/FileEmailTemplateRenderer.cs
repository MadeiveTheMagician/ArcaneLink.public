using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using ArcaneLink.Services.Email.Abstractions;

namespace ArcaneLink.Services.Email;

public sealed class FileEmailTemplateRenderer : IEmailTemplateRenderer
{
    private const string TemplateResourcePath = "Localization/auth.email.ru.json";
    private static readonly Regex PlaceholderPattern = new(
        @"\{\{(?<name>[a-z][a-z0-9_]*)\}\}",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly JsonSerializerOptions JsonOptions = new(
        JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IReadOnlyDictionary<string, EmailTemplateDocument> _templates;

    public FileEmailTemplateRenderer()
    {
        this._templates = LoadTemplates(
            Path.Combine(
                AppContext.BaseDirectory,
                TemplateResourcePath.Replace('/', Path.DirectorySeparatorChar)));
    }

    public RenderedEmailTemplate Render(
        string templateName,
        IReadOnlyDictionary<string, string>? variables = null)
    {
        if (!this._templates.TryGetValue(templateName, out var template))
        {
            throw new InvalidOperationException(
                $"Email template '{templateName}' is unavailable.");
        }

        variables ??= new Dictionary<string, string>();
        var usedVariables = new HashSet<string>(StringComparer.Ordinal);
        var subject = RenderPart(
            template.Subject,
            variables,
            usedVariables,
            encodeForHtml: false);
        var textBody = RenderPart(
            template.TextBody,
            variables,
            usedVariables,
            encodeForHtml: false);
        var htmlBody = RenderPart(
            template.HtmlBody,
            variables,
            usedVariables,
            encodeForHtml: true);

        var unusedVariables = variables.Keys
            .Where(key => !usedVariables.Contains(key))
            .ToArray();
        if (unusedVariables.Length > 0)
        {
            throw new InvalidOperationException(
                $"Email template '{templateName}' does not use variables: {string.Join(", ", unusedVariables)}.");
        }

        if (subject.Contains('\r') || subject.Contains('\n'))
        {
            throw new InvalidOperationException(
                $"Email template '{templateName}' produced an invalid subject.");
        }

        return new RenderedEmailTemplate(subject, textBody, htmlBody);
    }

    private static IReadOnlyDictionary<string, EmailTemplateDocument> LoadTemplates(
        string path)
    {
        if (!File.Exists(path))
        {
            throw new InvalidOperationException(
                $"Required email template resource is missing: {path}");
        }

        Dictionary<string, EmailTemplateDocument> templates;
        try
        {
            templates = JsonSerializer.Deserialize<Dictionary<string, EmailTemplateDocument>>(
                            File.ReadAllText(path),
                            JsonOptions)
                        ?? throw new JsonException("Template resource is empty.");
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException(
                $"Email template resource is invalid: {path}",
                exception);
        }

        var missingTemplates = EmailTemplateNames.All
            .Where(name => !templates.ContainsKey(name))
            .ToArray();
        if (missingTemplates.Length > 0)
        {
            throw new InvalidOperationException(
                $"Email template resource does not define: {string.Join(", ", missingTemplates)}.");
        }

        var unknownTemplates = templates.Keys
            .Where(name => !EmailTemplateNames.All.Contains(name, StringComparer.Ordinal))
            .ToArray();
        if (unknownTemplates.Length > 0)
        {
            throw new InvalidOperationException(
                $"Email template resource contains unknown templates: {string.Join(", ", unknownTemplates)}.");
        }

        foreach (var (name, template) in templates)
        {
            ValidateTemplate(name, template, $"{path}#{name}");
        }

        return templates;
    }

    private static void ValidateTemplate(
        string templateName,
        EmailTemplateDocument template,
        string path)
    {
        if (string.IsNullOrWhiteSpace(template.Subject) ||
            string.IsNullOrWhiteSpace(template.TextBody) ||
            string.IsNullOrWhiteSpace(template.HtmlBody))
        {
            throw new InvalidOperationException(
                $"Email template must define non-empty subject, textBody and htmlBody: {path}");
        }

        if (template.Subject.Contains('\r') || template.Subject.Contains('\n'))
        {
            throw new InvalidOperationException(
                $"Email template subject must be a single line: {path}");
        }

        ValidatePlaceholderSyntax(template.Subject, path);
        ValidatePlaceholderSyntax(template.TextBody, path);
        ValidatePlaceholderSyntax(template.HtmlBody, path);

        var actualVariables = PlaceholderPattern
            .Matches($"{template.Subject}\n{template.TextBody}\n{template.HtmlBody}")
            .Select(match => match.Groups["name"].Value)
            .ToHashSet(StringComparer.Ordinal);
        var requiredVariables = EmailTemplateNames.GetRequiredVariables(templateName);
        if (!actualVariables.SetEquals(requiredVariables))
        {
            throw new InvalidOperationException(
                $"Email template variables do not match the contract for '{templateName}': {path}");
        }
    }

    private static void ValidatePlaceholderSyntax(string value, string path)
    {
        var withoutValidPlaceholders = PlaceholderPattern.Replace(value, string.Empty);
        if (withoutValidPlaceholders.Contains("{{", StringComparison.Ordinal) ||
            withoutValidPlaceholders.Contains("}}", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Email template contains an invalid placeholder: {path}");
        }
    }

    private static string RenderPart(
        string value,
        IReadOnlyDictionary<string, string> variables,
        ISet<string> usedVariables,
        bool encodeForHtml)
    {
        return PlaceholderPattern.Replace(value, match =>
        {
            var name = match.Groups["name"].Value;
            if (!variables.TryGetValue(name, out var replacement))
            {
                throw new InvalidOperationException(
                    $"Email template variable '{name}' was not provided.");
            }

            usedVariables.Add(name);
            return encodeForHtml
                ? HtmlEncoder.Default.Encode(replacement)
                : replacement;
        });
    }
}
