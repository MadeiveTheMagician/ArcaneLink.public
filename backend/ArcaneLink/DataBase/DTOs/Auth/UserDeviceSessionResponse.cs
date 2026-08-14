namespace ArcaneLink.DataBase.DTOs.Auth
{
    public class UserDeviceSessionResponse
    {
        public Guid Id { get; set; }
        public string? DeviceName { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastUsedAt { get; set; }
        public bool IsCurrent { get; set; }
    }
}
