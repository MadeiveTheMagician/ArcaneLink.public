using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Auth;

public class DeviceSessionInfo
{
    [MaxLength(128)]
    public string? DeviceName { get; set; }
    [MaxLength(128)]
    public string? IpAdress { get; set; }
    [MaxLength(512)]
    public string? UserAgent { get; set; }
}
