using ArcaneLink.Configuration;
using ArcaneLink.Services.Email.Abstractions;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace ArcaneLink.Services.Email;

public sealed class MailKitEmailSender : IEmailSender
{
    private readonly EmailDeliveryOptions _options;

    public MailKitEmailSender(IOptions<EmailDeliveryOptions> options)
    {
        this._options = options.Value;
    }

    public async Task SendAsync(
        string recipient,
        string subject,
        string textBody,
        string htmlBody,
        CancellationToken cancellationToken = default)
    {
        if (!this._options.Enabled)
        {
            throw new InvalidOperationException(
                "Email delivery is disabled; refusing to discard an outbox message.");
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(this._options.FromName, this._options.FromAddress));
        message.To.Add(MailboxAddress.Parse(recipient));
        message.Subject = subject;
        message.Body = new BodyBuilder
        {
            TextBody = textBody,
            HtmlBody = htmlBody
        }.ToMessageBody();

        using var client = new SmtpClient();
        var socketOptions = this._options.UseSslOnConnect
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;
        await client.ConnectAsync(
            this._options.Host,
            this._options.Port,
            socketOptions,
            cancellationToken);
        await client.AuthenticateAsync(
            this._options.Username,
            this._options.Password,
            cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
