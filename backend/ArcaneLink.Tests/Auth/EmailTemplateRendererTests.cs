using ArcaneLink.Services.Email;

namespace ArcaneLink.Tests.Auth;

public sealed class EmailTemplateRendererTests
{
    [Fact]
    public void RussianResource_DefinesAndRendersEveryAccountEmail()
    {
        var renderer = new FileEmailTemplateRenderer();
        const string link =
            "https://arcane-link.ru/#action=confirm-email&token=test-token";

        foreach (var templateName in EmailTemplateNames.All)
        {
            var variables = EmailTemplateNames.GetRequiredVariables(templateName)
                .ToDictionary(
                    name => name,
                    name => name == "link" ? link : "24",
                    StringComparer.Ordinal);
            var rendered = renderer.Render(templateName, variables);

            Assert.False(string.IsNullOrWhiteSpace(rendered.Subject));
            Assert.False(string.IsNullOrWhiteSpace(rendered.TextBody));
            Assert.False(string.IsNullOrWhiteSpace(rendered.HtmlBody));
            Assert.DoesNotContain("{{", rendered.Subject, StringComparison.Ordinal);
            Assert.DoesNotContain("{{", rendered.TextBody, StringComparison.Ordinal);
            Assert.DoesNotContain("{{", rendered.HtmlBody, StringComparison.Ordinal);

            if (templateName == EmailTemplateNames.EmailChangedSecurityNotice)
            {
                continue;
            }

            Assert.Contains(link, rendered.TextBody, StringComparison.Ordinal);
            Assert.Contains("&amp;token=", rendered.HtmlBody, StringComparison.Ordinal);
            Assert.DoesNotContain("&token=", rendered.HtmlBody, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Render_FailsWhenRequiredVariableIsMissingOrUnknown()
    {
        var renderer = new FileEmailTemplateRenderer();

        Assert.Throws<InvalidOperationException>(() =>
            renderer.Render(EmailTemplateNames.EmailVerification));
        Assert.Throws<InvalidOperationException>(() =>
            renderer.Render(
                EmailTemplateNames.EmailChangedSecurityNotice,
                new Dictionary<string, string>(StringComparer.Ordinal)
                {
                    ["link"] = "https://example.test"
                }));
    }
}
