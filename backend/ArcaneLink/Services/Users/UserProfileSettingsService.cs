using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Services.Users
{
    public class UserProfileSettingsService : IUserProfileSettingsService
    {
        private const string DefaultThemeCode = "sapphire";

        private readonly AppDbContext _db;
        private readonly IRealtimeNotificationService _realtime;
        private readonly IUserPresenceCoordinator _presenceCoordinator;
        private readonly ILogger<UserProfileSettingsService> _logger;

        public UserProfileSettingsService(
            AppDbContext db,
            IRealtimeNotificationService realtime,
            IUserPresenceCoordinator presenceCoordinator,
            ILogger<UserProfileSettingsService> logger)
        {
            _db = db;
            _realtime = realtime;
            _presenceCoordinator = presenceCoordinator;
            _logger = logger;
        }

        public async Task<UserProfileSettingsResponse?> GetProfileSettingsAsync(
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            var user = await GetActiveUserWithProfileSettingsAsync(
                userId,
                cancellationToken);

            return user == null
                ? null
                : ToProfileSettingsResponse(user.ProfileSettings);
        }

        public async Task<UserProfileSettingsResponse?> UpdateProfileSettingsAsync(
            Guid userId,
            UpdateUserProfileSettingsRequest request,
            CancellationToken cancellationToken = default)
        {
            var user = await GetActiveUserWithProfileSettingsAsync(
                userId,
                cancellationToken);

            if (user == null)
            {
                return null;
            }

            var previousPresence = UserPresenceConfiguration.Create(
                user.ProfileSettings.PresenceVisibility,
                user.ProfileSettings.ShowLastSeen,
                user.ProfileSettings.PresenceMode);

            if (request.InterfaceScale != null)
            {
                user.ProfileSettings.InterfaceScale =
                    NormalizeInterfaceScale(request.InterfaceScale.Value);
            }

            if (request.FontScale != null)
            {
                user.ProfileSettings.FontScale =
                    NormalizeFontScale(request.FontScale.Value);
            }

            if (request.ServerInterfaceScale != null)
            {
                user.ProfileSettings.ServerInterfaceScale =
                    NormalizeServerInterfaceScale(request.ServerInterfaceScale.Value);
            }

            if (request.IsServerRailPinned != null)
            {
                user.ProfileSettings.IsServerRailPinned =
                    request.IsServerRailPinned.Value;
            }

            if (request.ShowPrivateReadAllButton != null)
            {
                user.ProfileSettings.ShowPrivateReadAllButton =
                    request.ShowPrivateReadAllButton.Value;
            }

            if (request.IsAllPrivateSpaceOrderLocked != null)
            {
                user.ProfileSettings.IsAllPrivateSpaceOrderLocked =
                    request.IsAllPrivateSpaceOrderLocked.Value;
            }

            if (request.ServerMessageDisplayFormat != null)
            {
                user.ProfileSettings.ServerMessageDisplayFormat =
                    MessageDisplayFormatCodes.Normalize(
                        request.ServerMessageDisplayFormat)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.MessageDisplayFormatIsInvalid);
            }

            if (request.PrivateMessageDisplayFormat != null)
            {
                user.ProfileSettings.PrivateMessageDisplayFormat =
                    MessageDisplayFormatCodes.Normalize(
                        request.PrivateMessageDisplayFormat)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.MessageDisplayFormatIsInvalid);
            }

            if (request.ServerMessageBubbleAlignment != null)
            {
                user.ProfileSettings.ServerMessageBubbleAlignment =
                    MessageBubbleAlignmentCodes.Normalize(
                        request.ServerMessageBubbleAlignment)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.MessageBubbleAlignmentIsInvalid);
            }

            if (request.PrivateMessageBubbleAlignment != null)
            {
                user.ProfileSettings.PrivateMessageBubbleAlignment =
                    MessageBubbleAlignmentCodes.Normalize(
                        request.PrivateMessageBubbleAlignment)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.MessageBubbleAlignmentIsInvalid);
            }

            if (request.ServerMessageBubbleWidth != null)
            {
                user.ProfileSettings.ServerMessageBubbleWidth =
                    MessageBubbleWidthCodes.Normalize(
                        request.ServerMessageBubbleWidth)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.MessageBubbleWidthIsInvalid);
            }

            if (request.PrivateMessageBubbleWidth != null)
            {
                user.ProfileSettings.PrivateMessageBubbleWidth =
                    MessageBubbleWidthCodes.Normalize(
                        request.PrivateMessageBubbleWidth)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.MessageBubbleWidthIsInvalid);
            }

            if (request.ExpandMessageAttachmentsByDefault != null)
            {
                user.ProfileSettings.ExpandMessageAttachmentsByDefault =
                    request.ExpandMessageAttachmentsByDefault.Value;
            }

            if (request.LoadExternalMediaPreviews != null)
            {
                user.ProfileSettings.LoadExternalMediaPreviews =
                    request.LoadExternalMediaPreviews.Value;
            }

            if (request.HorizontalVideoCardSize != null)
            {
                user.ProfileSettings.HorizontalVideoCardSize =
                    NormalizeVideoCardSize(request.HorizontalVideoCardSize.Value);
            }

            if (request.VerticalVideoCardSize != null)
            {
                user.ProfileSettings.VerticalVideoCardSize =
                    NormalizeVideoCardSize(request.VerticalVideoCardSize.Value);
            }

            if (request.SelectedThemeCode != null)
            {
                var theme = await GetThemeByCodeAsync(
                    request.SelectedThemeCode,
                    cancellationToken);

                if (theme != null)
                {
                    user.ProfileSettings.SelectedThemeId = theme.Id;
                    user.ProfileSettings.SelectedTheme = theme;
                }
            }

            if (request.ClearProfileColor == true)
            {
                user.ProfileSettings.ProfileColor = null;
            }
            else if (request.ProfileColor != null)
            {
                user.ProfileSettings.ProfileColor =
                    NormalizeProfileColor(request.ProfileColor);
            }

            if (request.ApplySystemThemeToOtherProfiles != null)
            {
                user.ProfileSettings.ApplySystemThemeToOtherProfiles =
                    request.ApplySystemThemeToOtherProfiles.Value;
            }

            if (request.DirectMessagePermission != null)
            {
                user.ProfileSettings.DirectMessagePermission =
                    DirectMessagePrivacyCodes.Normalize(
                        request.DirectMessagePermission)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.DirectMessagePermissionIsInvalid);
            }

            if (request.PresenceVisibility != null)
            {
                user.ProfileSettings.PresenceVisibility =
                    PresenceVisibilityCodes.Normalize(request.PresenceVisibility)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.PresenceVisibilityIsInvalid);
            }

            if (request.ShowLastSeen != null)
            {
                user.ProfileSettings.ShowLastSeen = request.ShowLastSeen.Value;
            }

            if (request.PresenceMode != null)
            {
                user.ProfileSettings.PresenceMode =
                    PresenceModeCodes.Normalize(request.PresenceMode)
                    ?? throw new InvalidUserProfileDataException(
                        ExceptionMessages.PresenceModeIsInvalid);
            }

            if (request.ClearProfileBackgroundAsset == true)
            {
                user.ProfileSettings.ProfileBackgroundAssetId = null;
                user.ProfileSettings.ProfileBackgroundAsset = null;
            }
            else if (request.ProfileBackgroundAssetId != null)
            {
                var backgroundAsset = await _db.Assets
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x => x.Id == request.ProfileBackgroundAssetId.Value &&
                             x.OwnerUserId == userId &&
                             x.DeletedAt == null,
                        cancellationToken);

                if (backgroundAsset == null)
                {
                    return null;
                }

                if (backgroundAsset.AssetTypeId != AssetTypeIds.ProfileBackground)
                {
                    throw new InvalidUserProfileDataException(
                        ExceptionMessages.ProfileBackgroundAssetTypeIsInvalid);
                }

                user.ProfileSettings.ProfileBackgroundAssetId = backgroundAsset.Id;
            }

            user.ProfileSettings.UpdatedAt = DateTime.UtcNow;
            user.UpdatedAt = user.ProfileSettings.UpdatedAt;

            var currentPresence = UserPresenceConfiguration.Create(
                user.ProfileSettings.PresenceVisibility,
                user.ProfileSettings.ShowLastSeen,
                user.ProfileSettings.PresenceMode);
            var presenceChanged = previousPresence != currentPresence;

            if (presenceChanged)
            {
                await _presenceCoordinator.ExecuteMutationAsync(
                    [userId],
                    token => _db.SaveChangesAsync(token),
                    cancellationToken);
            }
            else
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            await _realtime.NotifyUserBestEffortAsync(
                _logger,
                userId,
                RealtimeEventNames.UserProfileSettingsChanged,
                new { userId },
                CancellationToken.None);
            if (presenceChanged)
            {
                await _presenceCoordinator.SettingsChangedAsync(
                    userId,
                    previousPresence,
                    currentPresence,
                    CancellationToken.None);
            }

            return ToProfileSettingsResponse(user.ProfileSettings);
        }

        private async Task<User?> GetActiveUserWithProfileSettingsAsync(
            Guid userId,
            CancellationToken cancellationToken)
        {
            var user = await _db.Users
                .Include(x => x.ProfileSettings)
                    .ThenInclude(x => x.SelectedTheme)
                .FirstOrDefaultAsync(
                    x => x.Id == userId &&
                         x.DeletedAt == null &&
                         x.StatusId == UserStatusIds.Active,
                    cancellationToken);

            if (user == null)
            {
                return null;
            }

            if (user.ProfileSettings == null)
            {
                user.ProfileSettings = new UserProfileSettings
                {
                    UserId = user.Id,
                    InterfaceScale = 1,
                    FontScale = 1,
                    ServerInterfaceScale = 1,
                    IsServerRailPinned = false,
                    ShowPrivateReadAllButton = true,
                    IsAllPrivateSpaceOrderLocked = false,
                    ServerMessageDisplayFormat =
                        MessageDisplayFormatCodes.WallScroll,
                    PrivateMessageDisplayFormat =
                        MessageDisplayFormatCodes.WallScroll,
                    ServerMessageBubbleAlignment =
                        MessageBubbleAlignmentCodes.OwnRight,
                    PrivateMessageBubbleAlignment =
                        MessageBubbleAlignmentCodes.OwnRight,
                    ServerMessageBubbleWidth =
                        MessageBubbleWidthCodes.Standard,
                    PrivateMessageBubbleWidth =
                        MessageBubbleWidthCodes.Standard,
                    ExpandMessageAttachmentsByDefault = false,
                    LoadExternalMediaPreviews = true,
                    HorizontalVideoCardSize = 3,
                    VerticalVideoCardSize = 3,
                    SelectedThemeId = SystemThemeIds.Sapphire,
                    ProfileColor = null,
                    ProfileBackgroundAssetId = null,
                    ApplySystemThemeToOtherProfiles = true,
                    DirectMessagePermission = DirectMessagePrivacyCodes.Everyone,
                    PresenceVisibility = PresenceVisibilityCodes.Everyone,
                    ShowLastSeen = true,
                    PresenceMode = PresenceModeCodes.Automatic,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.UserProfileSettings.Add(user.ProfileSettings);
                await _db.SaveChangesAsync(cancellationToken);
            }

            return user;
        }

        private async Task<SystemTheme?> GetThemeByCodeAsync(
            string themeCode,
            CancellationToken cancellationToken)
        {
            var normalizedThemeCode = themeCode.Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(normalizedThemeCode))
            {
                return null;
            }

            return await _db.SystemThemes.FirstOrDefaultAsync(
                x => x.Code == normalizedThemeCode,
                cancellationToken);
        }

        private static double NormalizeInterfaceScale(double value)
        {
            return Math.Round(Math.Clamp(value, 0.75, 1.4), 2);
        }

        private static double NormalizeFontScale(double value)
        {
            return Math.Round(Math.Clamp(value, 0.85, 1.3), 2);
        }

        private static double NormalizeServerInterfaceScale(double value)
        {
            return Math.Round(Math.Clamp(value, 0.75, 1.4), 2);
        }

        private static int NormalizeVideoCardSize(int value)
        {
            return Math.Clamp(value, 1, 6);
        }

        private static string? NormalizeProfileColor(string value)
        {
            var color = value.Trim();

            if (string.IsNullOrWhiteSpace(color))
            {
                return null;
            }

            if (!color.StartsWith('#'))
            {
                color = $"#{color}";
            }

            if (color.Length != 7)
            {
                return null;
            }

            for (var index = 1; index < color.Length; index++)
            {
                if (!Uri.IsHexDigit(color[index]))
                {
                    return null;
                }
            }

            return color.ToLowerInvariant();
        }

        private static UserProfileSettingsResponse ToProfileSettingsResponse(
            UserProfileSettings settings)
        {
            return new UserProfileSettingsResponse
            {
                UserId = settings.UserId,
                InterfaceScale = settings.InterfaceScale,
                FontScale = settings.FontScale,
                ServerInterfaceScale = settings.ServerInterfaceScale,
                IsServerRailPinned = settings.IsServerRailPinned,
                ShowPrivateReadAllButton =
                    settings.ShowPrivateReadAllButton,
                IsAllPrivateSpaceOrderLocked =
                    settings.IsAllPrivateSpaceOrderLocked,
                ServerMessageDisplayFormat =
                    settings.ServerMessageDisplayFormat,
                PrivateMessageDisplayFormat =
                    settings.PrivateMessageDisplayFormat,
                ServerMessageBubbleAlignment =
                    settings.ServerMessageBubbleAlignment,
                PrivateMessageBubbleAlignment =
                    settings.PrivateMessageBubbleAlignment,
                ServerMessageBubbleWidth =
                    settings.ServerMessageBubbleWidth,
                PrivateMessageBubbleWidth =
                    settings.PrivateMessageBubbleWidth,
                ExpandMessageAttachmentsByDefault =
                    settings.ExpandMessageAttachmentsByDefault,
                LoadExternalMediaPreviews = settings.LoadExternalMediaPreviews,
                HorizontalVideoCardSize = settings.HorizontalVideoCardSize,
                VerticalVideoCardSize = settings.VerticalVideoCardSize,
                SelectedThemeCode = settings.SelectedTheme?.Code ?? DefaultThemeCode,
                ProfileColor = settings.ProfileColor,
                ProfileBackgroundAssetId = settings.ProfileBackgroundAssetId,
                ApplySystemThemeToOtherProfiles =
                    settings.ApplySystemThemeToOtherProfiles,
                DirectMessagePermission = settings.DirectMessagePermission,
                PresenceVisibility = settings.PresenceVisibility,
                ShowLastSeen = settings.ShowLastSeen,
                PresenceMode = settings.PresenceMode,
                UpdatedAt = settings.UpdatedAt
            };
        }
    }
}
