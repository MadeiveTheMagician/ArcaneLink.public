using ArcaneLink.Services.Assets;

namespace ArcaneLink.Tests.Assets;

public sealed class FileTypeInspectorTests
{
    [Theory]
    [MemberData(nameof(VideoSignatures))]
    public void Inspect_RecognizesSupportedVideoSignatures(
        byte[] signature,
        string expectedMimeType,
        string expectedExtension)
    {
        var inspected = FileTypeInspector.Inspect(signature);

        Assert.NotNull(inspected);
        Assert.Equal(expectedMimeType, inspected.MimeType);
        Assert.Equal(expectedExtension, inspected.Extension);
        Assert.True(inspected.IsSafeInline);
    }

    [Fact]
    public void Inspect_DoesNotTrustVideoFileNameWithoutSignature()
    {
        var inspected = FileTypeInspector.Inspect([0x00, 0x01, 0x02, 0x03]);

        Assert.Null(inspected);
    }

    public static TheoryData<byte[], string, string> VideoSignatures => new()
    {
        {
            [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D],
            "video/mp4",
            ".mp4"
        },
        {
            [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20],
            "video/quicktime",
            ".mov"
        },
        {
            [0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81],
            "video/webm",
            ".webm"
        },
        {
            [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20],
            "video/x-msvideo",
            ".avi"
        }
    };
}
