using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.AssetExceptions;
using ArcaneLink.Services.Assets;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace ArcaneLink.Services.Users;

public sealed class AvatarImageProcessor
{
    private readonly AssetUploadOptions _options;

    public AvatarImageProcessor(IOptions<AssetUploadOptions> options)
    {
        this._options = options.Value;
    }

    public int OutputSizePixels => Math.Clamp(
        this._options.AvatarSizePixels,
        128,
        2048);

    public async Task<MemoryStream> ProcessAsync(
        Stream source,
        double cropOffsetX,
        double cropOffsetY,
        double cropZoom,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var encodedBuffer = new MemoryStream();
            await source.CopyToAsync(encodedBuffer, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();

            using var data = SKData.CreateCopy(encodedBuffer.ToArray());
            using var codec = SKCodec.Create(data)
                ?? throw InvalidAvatarImage();
            using var decoded = this.DecodeBounded(codec);
            using var oriented = ApplyEncodedOrientation(
                decoded,
                codec.EncodedOrigin);
            using var outputBitmap = new SKBitmap(new SKImageInfo(
                this.OutputSizePixels,
                this.OutputSizePixels,
                SKColorType.Rgba8888,
                SKAlphaType.Premul));
            using var canvas = new SKCanvas(outputBitmap);
            using var paint = new SKPaint
            {
                IsAntialias = true
            };
            var sampling = new SKSamplingOptions(
                SKCubicResampler.Mitchell);

            canvas.Clear(SKColors.Transparent);

            var containScale = Math.Min(
                this.OutputSizePixels / (double)oriented.Width,
                this.OutputSizePixels / (double)oriented.Height);
            var renderedWidth = (float)(
                oriented.Width * containScale * cropZoom);
            var renderedHeight = (float)(
                oriented.Height * containScale * cropZoom);
            var renderedX = (float)(
                (this.OutputSizePixels - renderedWidth) / 2d +
                cropOffsetX * this.OutputSizePixels);
            var renderedY = (float)(
                (this.OutputSizePixels - renderedHeight) / 2d +
                cropOffsetY * this.OutputSizePixels);

            canvas.DrawBitmap(
                oriented,
                new SKRect(
                    renderedX,
                    renderedY,
                    renderedX + renderedWidth,
                    renderedY + renderedHeight),
                sampling,
                paint);
            canvas.Flush();

            using var outputImage = SKImage.FromBitmap(outputBitmap);
            using var webp = outputImage.Encode(
                SKEncodedImageFormat.Webp,
                Math.Clamp(this._options.AvatarWebpQuality, 1, 100))
                ?? throw InvalidAvatarImage();
            var output = new MemoryStream();
            webp.SaveTo(output);
            output.Position = 0;

            return output;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (InvalidAssetDataException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is ArgumentException or
            InvalidOperationException or
            NotSupportedException)
        {
            throw InvalidAvatarImage();
        }
    }

    private SKBitmap DecodeBounded(SKCodec codec)
    {
        var originalInfo = codec.Info;

        if (originalInfo.Width <= 0 || originalInfo.Height <= 0)
        {
            throw InvalidAvatarImage();
        }

        var maxDecodeSize = Math.Clamp(
            this._options.AvatarMaxDecodeSizePixels,
            this.OutputSizePixels,
            8192);
        var desiredScale = Math.Min(
            1f,
            maxDecodeSize / (float)Math.Max(
                originalInfo.Width,
                originalInfo.Height));
        var scaledSize = codec.GetScaledDimensions(desiredScale);
        var scaledInfo = new SKImageInfo(
            scaledSize.Width,
            scaledSize.Height,
            SKColorType.Rgba8888,
            SKAlphaType.Premul);
        var bitmap = new SKBitmap(scaledInfo);
        var result = codec.GetPixels(
            scaledInfo,
            bitmap.GetPixels());

        if (result == SKCodecResult.Success)
        {
            return bitmap;
        }

        bitmap.Dispose();

        const long maxFallbackPixels = 40_000_000;
        if ((long)originalInfo.Width * originalInfo.Height > maxFallbackPixels)
        {
            throw InvalidAvatarImage();
        }

        var fallbackInfo = new SKImageInfo(
            originalInfo.Width,
            originalInfo.Height,
            SKColorType.Rgba8888,
            SKAlphaType.Premul);
        var fallback = new SKBitmap(fallbackInfo);
        result = codec.GetPixels(
            fallbackInfo,
            fallback.GetPixels());

        if (result == SKCodecResult.Success)
        {
            return fallback;
        }

        fallback.Dispose();
        throw InvalidAvatarImage();
    }

    private static SKBitmap ApplyEncodedOrientation(
        SKBitmap source,
        SKEncodedOrigin origin)
    {
        var swapsDimensions = origin is
            SKEncodedOrigin.LeftTop or
            SKEncodedOrigin.RightTop or
            SKEncodedOrigin.RightBottom or
            SKEncodedOrigin.LeftBottom;
        var output = new SKBitmap(new SKImageInfo(
            swapsDimensions ? source.Height : source.Width,
            swapsDimensions ? source.Width : source.Height,
            SKColorType.Rgba8888,
            SKAlphaType.Premul));
        using var canvas = new SKCanvas(output);

        canvas.Clear(SKColors.Transparent);
        canvas.SetMatrix(CreateOrientationMatrix(
            origin,
            source.Width,
            source.Height));
        canvas.DrawBitmap(
            source,
            0,
            0,
            SKSamplingOptions.Default,
            null);
        canvas.Flush();

        return output;
    }

    private static SKMatrix CreateOrientationMatrix(
        SKEncodedOrigin origin,
        int width,
        int height)
    {
        return origin switch
        {
            SKEncodedOrigin.TopRight => new SKMatrix
            {
                ScaleX = -1,
                ScaleY = 1,
                TransX = width,
                Persp2 = 1
            },
            SKEncodedOrigin.BottomRight => new SKMatrix
            {
                ScaleX = -1,
                ScaleY = -1,
                TransX = width,
                TransY = height,
                Persp2 = 1
            },
            SKEncodedOrigin.BottomLeft => new SKMatrix
            {
                ScaleX = 1,
                ScaleY = -1,
                TransY = height,
                Persp2 = 1
            },
            SKEncodedOrigin.LeftTop => new SKMatrix
            {
                SkewX = 1,
                SkewY = 1,
                Persp2 = 1
            },
            SKEncodedOrigin.RightTop => new SKMatrix
            {
                SkewX = -1,
                SkewY = 1,
                TransX = height,
                Persp2 = 1
            },
            SKEncodedOrigin.RightBottom => new SKMatrix
            {
                SkewX = -1,
                SkewY = -1,
                TransX = height,
                TransY = width,
                Persp2 = 1
            },
            SKEncodedOrigin.LeftBottom => new SKMatrix
            {
                SkewX = 1,
                SkewY = -1,
                TransY = width,
                Persp2 = 1
            },
            _ => SKMatrix.Identity
        };
    }

    private static InvalidAssetDataException InvalidAvatarImage()
    {
        return new InvalidAssetDataException(
            ExceptionMessages.AvatarImageIsInvalid);
    }
}
