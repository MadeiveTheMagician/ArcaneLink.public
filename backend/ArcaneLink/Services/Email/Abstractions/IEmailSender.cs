namespace ArcaneLink.Services.Email.Abstractions;

public interface IEmailSender
{
    Task SendAsync(
        string recipient,
        string subject,
        string textBody,
        string htmlBody,
        CancellationToken cancellationToken = default);
}
