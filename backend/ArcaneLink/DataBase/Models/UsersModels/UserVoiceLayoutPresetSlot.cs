namespace ArcaneLink.DataBase.Models.UsersModels;

public class UserVoiceLayoutPresetSlot
{
    public Guid Id { get; set; }

    public Guid PresetId { get; set; }
    public UserVoiceLayoutPreset Preset { get; set; } = null!;

    public int SlotIndex { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public double BorderRadius { get; set; }
    public int ZIndex { get; set; }
    public required string Mode { get; set; }
    public bool PreserveAspectRatio { get; set; }
    public required string AspectRatio { get; set; }
}
