namespace ArcaneLink.Services.Email.Abstractions;

public interface IEmailOutboxQueue
{
    void EnqueueEmail(OutboxEmail email);
    void EnqueueLookup(string kind, string lookup);
}
