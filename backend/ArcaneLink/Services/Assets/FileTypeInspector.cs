namespace ArcaneLink.Services.Assets
{
    public sealed record InspectedFileType(
        string MimeType,
        string Extension,
        bool IsSafeInline);

    public static class FileTypeInspector
    {
        public static InspectedFileType? Inspect(ReadOnlySpan<byte> bytes)
        {
            if (IsJpeg(bytes))
            {
                return new InspectedFileType("image/jpeg", ".jpg", true);
            }

            if (IsPng(bytes))
            {
                return new InspectedFileType("image/png", ".png", true);
            }

            if (IsWebp(bytes))
            {
                return new InspectedFileType("image/webp", ".webp", true);
            }

            if (IsGif(bytes))
            {
                return new InspectedFileType("image/gif", ".gif", true);
            }

            if (IsBmp(bytes))
            {
                return new InspectedFileType("image/bmp", ".bmp", true);
            }

            if (IsIsoBaseMedia(bytes, out var isoMediaType))
            {
                return isoMediaType;
            }

            if (IsWebm(bytes))
            {
                return new InspectedFileType("video/webm", ".webm", true);
            }

            if (IsAvi(bytes))
            {
                return new InspectedFileType("video/x-msvideo", ".avi", true);
            }

            return null;
        }

        private static bool IsJpeg(ReadOnlySpan<byte> bytes)
        {
            return bytes.Length >= 3 &&
                   bytes[0] == 0xFF &&
                   bytes[1] == 0xD8 &&
                   bytes[2] == 0xFF;
        }

        private static bool IsPng(ReadOnlySpan<byte> bytes)
        {
            ReadOnlySpan<byte> signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            return bytes.StartsWith(signature);
        }

        private static bool IsWebp(ReadOnlySpan<byte> bytes)
        {
            return bytes.Length >= 12 &&
                   bytes[0] == 0x52 &&
                   bytes[1] == 0x49 &&
                   bytes[2] == 0x46 &&
                   bytes[3] == 0x46 &&
                   bytes[8] == 0x57 &&
                   bytes[9] == 0x45 &&
                   bytes[10] == 0x42 &&
                   bytes[11] == 0x50;
        }

        private static bool IsGif(ReadOnlySpan<byte> bytes)
        {
            return bytes.Length >= 6 &&
                   bytes[0] == 0x47 &&
                   bytes[1] == 0x49 &&
                   bytes[2] == 0x46 &&
                   bytes[3] == 0x38 &&
                   (bytes[4] == 0x37 || bytes[4] == 0x39) &&
                   bytes[5] == 0x61;
        }

        private static bool IsBmp(ReadOnlySpan<byte> bytes)
        {
            return bytes.Length >= 2 &&
                   bytes[0] == 0x42 &&
                   bytes[1] == 0x4D;
        }

        private static bool IsIsoBaseMedia(
            ReadOnlySpan<byte> bytes,
            out InspectedFileType? inspectedFileType)
        {
            inspectedFileType = null;

            if (bytes.Length < 12 ||
                bytes[4] != 0x66 ||
                bytes[5] != 0x74 ||
                bytes[6] != 0x79 ||
                bytes[7] != 0x70)
            {
                return false;
            }

            var isQuickTime = bytes[8] == 0x71 &&
                              bytes[9] == 0x74 &&
                              bytes[10] == 0x20 &&
                              bytes[11] == 0x20;

            inspectedFileType = isQuickTime
                ? new InspectedFileType("video/quicktime", ".mov", true)
                : new InspectedFileType("video/mp4", ".mp4", true);

            return true;
        }

        private static bool IsWebm(ReadOnlySpan<byte> bytes)
        {
            return bytes.Length >= 4 &&
                   bytes[0] == 0x1A &&
                   bytes[1] == 0x45 &&
                   bytes[2] == 0xDF &&
                   bytes[3] == 0xA3;
        }

        private static bool IsAvi(ReadOnlySpan<byte> bytes)
        {
            return bytes.Length >= 12 &&
                   bytes[0] == 0x52 &&
                   bytes[1] == 0x49 &&
                   bytes[2] == 0x46 &&
                   bytes[3] == 0x46 &&
                   bytes[8] == 0x41 &&
                   bytes[9] == 0x56 &&
                   bytes[10] == 0x49 &&
                   bytes[11] == 0x20;
        }
    }
}
