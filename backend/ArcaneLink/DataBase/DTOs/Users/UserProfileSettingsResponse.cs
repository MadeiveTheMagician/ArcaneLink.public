namespace ArcaneLink.DataBase.DTOs.Users;

public class UserProfileSettingsResponse
{
    public Guid UserId { get; set; }
    public double InterfaceScale { get; set; } = 1;
    public double FontScale { get; set; } = 1;
    public double ServerInterfaceScale { get; set; } = 1;
    public bool IsServerRailPinned { get; set; }
    public bool ShowPrivateReadAllButton { get; set; } = true;
    public bool IsAllPrivateSpaceOrderLocked { get; set; }
    public string ServerMessageDisplayFormat { get; set; } = "wall-scroll";
    public string PrivateMessageDisplayFormat { get; set; } = "wall-scroll";
    public string ServerMessageBubbleAlignment { get; set; } = "own-right";
    public string PrivateMessageBubbleAlignment { get; set; } = "own-right";
    public string ServerMessageBubbleWidth { get; set; } = "standard";
    public string PrivateMessageBubbleWidth { get; set; } = "standard";
    public bool ExpandMessageAttachmentsByDefault { get; set; }
    public bool LoadExternalMediaPreviews { get; set; } = true;
    public int HorizontalVideoCardSize { get; set; } = 3;
    public int VerticalVideoCardSize { get; set; } = 3;
    public string SelectedThemeCode { get; set; } = "sapphire";
    public string? ProfileColor { get; set; }
    public Guid? ProfileBackgroundAssetId { get; set; }
    public bool ApplySystemThemeToOtherProfiles { get; set; } = true;
    public string DirectMessagePermission { get; set; } = "everyone";
    public string PresenceVisibility { get; set; } = "everyone";
    public bool ShowLastSeen { get; set; } = true;
    public string PresenceMode { get; set; } = "automatic";
    public DateTime UpdatedAt { get; set; }
}
