using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Users;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace ArcaneLink.Tests.Assets;

public sealed class AvatarImageProcessorTests
{
    [Fact]
    public async Task ProcessAsync_MatchesContainedEditorGeometryAndWritesWebp()
    {
        await using var source = CreateTwoColorPng();
        var processor = CreateProcessor();

        await using var result = await processor.ProcessAsync(
            source,
            cropOffsetX: 0,
            cropOffsetY: 0,
            cropZoom: 1);
        var outputBytes = result.ToArray();
        using var bitmap = SKBitmap.Decode(outputBytes);

        Assert.NotNull(bitmap);
        Assert.Equal(512, bitmap.Width);
        Assert.Equal(512, bitmap.Height);
        Assert.Equal(0, bitmap.GetPixel(256, 64).Alpha);
        Assert.True(bitmap.GetPixel(128, 256).Red > 200);
        Assert.True(bitmap.GetPixel(384, 256).Blue > 200);

        Assert.Equal("RIFF", System.Text.Encoding.ASCII.GetString(outputBytes, 0, 4));
        Assert.Equal("WEBP", System.Text.Encoding.ASCII.GetString(outputBytes, 8, 4));
    }

    [Fact]
    public async Task ProcessAsync_AppliesNormalizedOffsetBeforeEncoding()
    {
        await using var source = CreateTwoColorPng();
        var processor = CreateProcessor();

        await using var result = await processor.ProcessAsync(
            source,
            cropOffsetX: 0.25,
            cropOffsetY: 0,
            cropZoom: 2);
        using var bitmap = SKBitmap.Decode(result);

        Assert.NotNull(bitmap);
        Assert.True(bitmap.GetPixel(256, 256).Red > 200);
        Assert.True(bitmap.GetPixel(256, 256).Blue < 80);
    }

    private static AvatarImageProcessor CreateProcessor()
    {
        return new AvatarImageProcessor(Options.Create(new AssetUploadOptions
        {
            AvatarSizePixels = 512,
            AvatarWebpQuality = 82,
            AvatarMaxDecodeSizePixels = 4096
        }));
    }

    private static MemoryStream CreateTwoColorPng()
    {
        using var bitmap = new SKBitmap(new SKImageInfo(
            200,
            100,
            SKColorType.Rgba8888,
            SKAlphaType.Premul));
        using var canvas = new SKCanvas(bitmap);
        using var paint = new SKPaint();

        paint.Color = SKColors.Red;
        canvas.DrawRect(0, 0, 100, 100, paint);
        paint.Color = SKColors.Blue;
        canvas.DrawRect(100, 0, 100, 100, paint);
        canvas.Flush();

        using var image = SKImage.FromBitmap(bitmap);
        using var png = image.Encode(SKEncodedImageFormat.Png, 100);
        var stream = new MemoryStream();
        png.SaveTo(stream);
        stream.Position = 0;

        return stream;
    }
}
