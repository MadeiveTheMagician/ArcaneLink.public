namespace ArcaneLink.DataBase.Models.AuthModels;

public sealed class EmailOutboxMessage
{
    public Guid Id { get; set; }
    public required string Kind { get; set; }
    public required string ProtectedPayload { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime AvailableAt { get; set; }
    public int AttemptCount { get; set; }
    public Guid? LeaseId { get; set; }
    public DateTime? LeaseExpiresAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public DateTime? DeadLetteredAt { get; set; }
    public string? LastError { get; set; }
}
