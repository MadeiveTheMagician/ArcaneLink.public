using System.Text.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Models.AuthModels;
using ArcaneLink.Services.Email.Abstractions;
using Microsoft.AspNetCore.DataProtection;

namespace ArcaneLink.Services.Email;

public sealed class EmailOutboxQueue : IEmailOutboxQueue
{
    private const string ProtectorPurpose = "ArcaneLink.EmailOutbox.Payload.v1";
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _db;
    private readonly IDataProtector _protector;

    public EmailOutboxQueue(AppDbContext db, IDataProtectionProvider dataProtection)
    {
        _db = db;
        _protector = dataProtection.CreateProtector(ProtectorPurpose);
    }

    public void EnqueueEmail(OutboxEmail email) => Add("send", email);

    public void EnqueueLookup(string kind, string lookup) =>
        Add(kind, new EmailLookupPayload(lookup));

    private void Add<T>(string kind, T payload)
    {
        var now = DateTime.UtcNow;
        _db.EmailOutboxMessages.Add(new EmailOutboxMessage
        {
            Id = Guid.NewGuid(),
            Kind = kind,
            ProtectedPayload = _protector.Protect(
                JsonSerializer.Serialize(payload, JsonOptions)),
            CreatedAt = now,
            AvailableAt = now
        });
    }
}
