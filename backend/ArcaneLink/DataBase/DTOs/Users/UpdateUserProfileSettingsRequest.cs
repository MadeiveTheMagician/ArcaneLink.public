namespace ArcaneLink.DataBase.DTOs.Users
{
    public class UpdateUserProfileSettingsRequest
    {
        public double? InterfaceScale { get; set; }
        public double? FontScale { get; set; }
        public double? ServerInterfaceScale { get; set; }
        public bool? IsServerRailPinned { get; set; }
        public bool? ShowPrivateReadAllButton { get; set; }
        public bool? IsAllPrivateSpaceOrderLocked { get; set; }
        public string? ServerMessageDisplayFormat { get; set; }
        public string? PrivateMessageDisplayFormat { get; set; }
        public string? ServerMessageBubbleAlignment { get; set; }
        public string? PrivateMessageBubbleAlignment { get; set; }
        public string? ServerMessageBubbleWidth { get; set; }
        public string? PrivateMessageBubbleWidth { get; set; }
        public bool? ExpandMessageAttachmentsByDefault { get; set; }
        public bool? LoadExternalMediaPreviews { get; set; }
        public int? HorizontalVideoCardSize { get; set; }
        public int? VerticalVideoCardSize { get; set; }
        public string? SelectedThemeCode { get; set; }
        public string? ProfileColor { get; set; }
        public bool? ClearProfileColor { get; set; }
        public Guid? ProfileBackgroundAssetId { get; set; }
        public bool? ClearProfileBackgroundAsset { get; set; }
        public bool? ApplySystemThemeToOtherProfiles { get; set; }
        public string? DirectMessagePermission { get; set; }
        public string? PresenceVisibility { get; set; }
        public bool? ShowLastSeen { get; set; }
        public string? PresenceMode { get; set; }
    }
}
