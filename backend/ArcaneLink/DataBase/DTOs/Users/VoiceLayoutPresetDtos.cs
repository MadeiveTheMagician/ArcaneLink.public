namespace ArcaneLink.DataBase.DTOs.Users;

public class VoiceLayoutPresetSlotRequest
{
    public int Index { get; set; }
    public bool PreserveAspectRatio { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public double BorderRadius { get; set; }
    public int ZIndex { get; set; }
    public string Mode { get; set; } = "grid";
    public string AspectRatio { get; set; } = "16:9";
}

public class VoiceLayoutPresetRequest
{
    public Guid? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public bool ShowParticipantsWithoutVideo { get; set; }
    public bool HideServiceInfo { get; set; }
    public int GridColumns { get; set; }
    public int GridRows { get; set; }
    public int CellSizePx { get; set; }
    public List<VoiceLayoutPresetSlotRequest> Slots { get; set; } = [];
}

public class VoiceLayoutPresetSlotResponse
{
    public Guid Id { get; set; }
    public int Index { get; set; }
    public bool PreserveAspectRatio { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
    public double BorderRadius { get; set; }
    public int ZIndex { get; set; }
    public string Mode { get; set; } = "grid";
    public string AspectRatio { get; set; } = "16:9";
}

public class VoiceLayoutPresetResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsPinned { get; set; }
    public bool ShowParticipantsWithoutVideo { get; set; }
    public bool HideServiceInfo { get; set; }
    public int GridColumns { get; set; }
    public int GridRows { get; set; }
    public int CellSizePx { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<VoiceLayoutPresetSlotResponse> Slots { get; set; } = [];
}
