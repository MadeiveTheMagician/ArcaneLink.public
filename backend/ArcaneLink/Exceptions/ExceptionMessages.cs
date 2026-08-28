namespace ArcaneLink.Exceptions
{
    // Централизованное хранилище текстов ошибок.
    //
    // Зачем:
    // 1. Не дублировать строки по проекту
    // 2. Упростить будущую локализацию
    // 3. Сделать exception-классы чище
    public static class ExceptionMessages
    {

        // ----------- USER EXCEPTIONS ----------
        public const string LoginAlreadyExists = "Login already exists.";
        public const string EmailAlreadyExists = "Email already exists.";
        public const string InvalidRegistrationData = "Invalid registration data.";
        public const string LoginIsRequired = "Login is required.";
        public const string EmailIsRequired = "Email is required.";
        public const string DisplayNameIsRequired = "Display name is required.";
        public const string PasswordIsInvalid = "Password is invalid.";
        public const string InvalidProfileData = "Invalid profile data.";
        public const string ProfileUpdateIsEmpty = "Profile update is empty.";
        public const string WebsiteUrlIsInvalid = "Website URL is invalid.";
        public const string ProfileAvatarAssetTypeIsInvalid = "Profile avatar asset type is invalid.";
        public const string ProfileBannerAssetTypeIsInvalid = "Profile banner asset type is invalid.";
        public const string ProfileBackgroundAssetTypeIsInvalid = "Profile background asset type is invalid.";
        public const string PresenceVisibilityIsInvalid = "Presence visibility is invalid.";
        public const string PresenceModeIsInvalid = "Presence mode is invalid.";
        public const string DirectMessagePermissionIsInvalid = "Direct message permission is invalid.";
        public const string MessageDisplayFormatIsInvalid = "Message display format is invalid.";
        public const string MessageBubbleAlignmentIsInvalid = "Message bubble alignment is invalid.";
        public const string MessageBubbleWidthIsInvalid = "Message bubble width is invalid.";
        public const string DirectMessagePrivacyDenied = "Настройки приватности пользователя не позволяют начать с ним новую личную переписку.";


        // ----------- LOGIN SYSTEM EXCEPTIONS ----------
        public const string NonexistentPasswordCredentials = "Invalid login or password.";


        // ----------- AUTH EXCEPTIONS ----------

        public const string RefreshTokenGenerationFailed = "Failed to generate a unique refresh token.";
        public const string InvalidRefreshToken = "Invalid refresh token.";
        public const string UserWasBanned = "User was banned";

        // ----------- REQUEST EXCEPTIONS ----------

        public const string IpAddressIsNull = "IP address is null.";
        public const string UserAgentIsNull = "User agent is null.";

        // ----------- SYSTEM EXCEPTIONS ----------

        public const string InternalServerError = "Internal server error.";

        // ----------- ASSET EXCEPTIONS ----------

        public const string AssetTypeDoesNotExist = "Asset type does not exist.";
        public const string InvalidAssetData = "Invalid asset data.";
        public const string AssetSizeMustBePositive = "Asset size must be positive.";
        public const string AssetSha256IsInvalid = "Asset SHA256 is invalid.";
        public const string AssetFileIsRequired = "Asset file is required.";
        public const string AssetFileIsTooLarge = "Asset file is too large.";
        public const string AssetMimeTypeIsNotAllowed = "Asset MIME type is not allowed.";
        public const string AssetFileSignatureIsInvalid = "Asset file content does not match an allowed file type.";
        public const string AvatarImageIsInvalid = "Avatar image could not be decoded.";
        public const string AvatarCropIsInvalid = "Avatar crop parameters are invalid.";
        public const string AssetAttachmentCountIsTooLarge = "Too many attachments.";
        public const string ProfileBannerAssetCountIsTooLarge = "Too many profile banner assets.";
        public const string ProfileBackgroundAssetCountIsTooLarge = "Too many profile background assets.";

        // ----------- SERVER EXCEPTIONS ----------

        public const string InvalidServerData = "Invalid server data.";
        public const string ServerSlugAlreadyExists = "Server slug already exists.";
        public const string ServerSlugIsInvalid = "Server slug is invalid.";
        public const string ServerTitleIsRequired = "Server title is required.";
        public const string ServerUpdateIsEmpty = "Server update is empty.";
        public const string ServerIconAssetIsInvalid = "Server icon asset is invalid.";
        public const string ServerAccessModeIsInvalid = "Server access mode is invalid.";
        public const string ServerOwnerCannotLeave = "Server owner cannot leave the server before transferring ownership.";
        public const string ServerOwnerCannotBeRemoved = "Server owner cannot be removed from the server.";
        public const string ServerOwnerCannotBeBanned = "Server owner cannot be banned from the server.";
    }
}
