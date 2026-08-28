namespace ArcaneLink.DataBase.DTOs.Users;

public class SetAvatarRequest
{
    public double CropOffsetX { get; set; }
    public double CropOffsetY { get; set; }
    public double CropZoom { get; set; } = 1;
}
