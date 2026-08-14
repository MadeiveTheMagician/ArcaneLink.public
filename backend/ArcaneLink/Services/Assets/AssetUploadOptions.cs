namespace ArcaneLink.Services.Assets
{
    public sealed class AssetUploadOptions
    {
        public const string SectionName = "AssetUploads";

        public string DefaultAttachmentPlan { get; set; } = "free";
        public long MaxImageUploadSizeBytes { get; set; } = 10 * 1024 * 1024;
        public int AvatarSizePixels { get; set; } = 512;
        public int AvatarWebpQuality { get; set; } = 82;
        public int AvatarMaxDecodeSizePixels { get; set; } = 4096;
        public int MaxAttachmentsPerMessage { get; set; } = 10;
        public int MaxProfileBannerAssets { get; set; } = 10;
        public string DefaultProfileBackgroundPlan { get; set; } = "free";
        public Dictionary<string, int> ProfileBackgroundAssetLimits { get; set; } =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["free"] = 10,
                ["plus"] = 30,
                ["prime"] = 50
            };
        public Dictionary<string, long> AttachmentSizeLimitsBytes { get; set; } =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["free"] = 10 * 1024 * 1024,
                ["plus"] = 200L * 1024 * 1024,
                ["prime"] = 1024L * 1024 * 1024
            };

        public string[] AllowedImageMimeTypes { get; set; } =
        [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/bmp"
        ];

        public string[] DangerousAttachmentExtensions { get; set; } =
        [
            ".exe",
            ".com",
            ".scr",
            ".pif",
            ".bat",
            ".cmd",
            ".ps1",
            ".vbs",
            ".js",
            ".jse",
            ".wsf",
            ".wsh",
            ".msi",
            ".msp",
            ".appx",
            ".msix"
        ];

        public string[] ArchiveAttachmentExtensions { get; set; } =
        [
            ".zip",
            ".rar",
            ".7z",
            ".tar",
            ".gz"
        ];

        public string[] RegistryAttachmentExtensions { get; set; } =
        [
            ".reg"
        ];

        public long GetAttachmentUploadLimitBytes(string? plan = null)
        {
            var effectivePlan = string.IsNullOrWhiteSpace(plan)
                ? DefaultAttachmentPlan
                : plan;

            return AttachmentSizeLimitsBytes.TryGetValue(
                effectivePlan,
                out var configuredLimit)
                ? configuredLimit
                : AttachmentSizeLimitsBytes["free"];
        }

        public int GetProfileBackgroundAssetLimit(string? plan = null)
        {
            var effectivePlan = string.IsNullOrWhiteSpace(plan)
                ? DefaultProfileBackgroundPlan
                : plan;

            return ProfileBackgroundAssetLimits.TryGetValue(
                effectivePlan,
                out var configuredLimit)
                ? configuredLimit
                : ProfileBackgroundAssetLimits["free"];
        }
    }
}
