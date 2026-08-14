using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Tests.Infrastructure;
using SkiaSharp;

namespace ArcaneLink.Tests.Users;

public sealed class UserAvatarIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly ArcaneLinkApiFactory _factory;
    private readonly HttpClient _client;

    public UserAvatarIntegrationTests(ArcaneLinkApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task UploadAndReuseAvatar_PreservesSourceAndReplacesOptimizedCurrent()
    {
        var accessToken = await _client.LoginAsync("owner");
        _client.AuthorizeWith(accessToken);
        await using var source = CreateSourcePng();
        var sourceBytes = source.ToArray();
        Guid? sourceAssetId = null;
        Guid? currentAssetId = null;

        try
        {
            using var upload = CreateUploadContent(
                sourceBytes,
                cropOffsetX: 0.12,
                cropOffsetY: -0.08,
                cropZoom: 1.65);
            var uploadResponse = await _client.PostAsync(
                "/api/users/me/profile/avatar/upload",
                upload);
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(uploadResponse);
            var profile = await uploadResponse.Content
                .ReadFromJsonAsync<OwnUserProfileResponse>();

            Assert.NotNull(profile);
            currentAssetId = Assert.IsType<Guid>(profile.AvatarAssetId);
            sourceAssetId = Assert.IsType<Guid>(profile.AvatarSourceAssetId);
            Assert.Equal(0, profile.AvatarCropOffsetX);
            Assert.Equal(0, profile.AvatarCropOffsetY);
            Assert.Equal(1, profile.AvatarCropZoom);

            var currentAsset = await _client.GetFromJsonAsync<AssetResponse>(
                $"/api/assets/{currentAssetId}");

            Assert.NotNull(currentAsset);
            Assert.Equal(AssetTypeIds.CurrentAvatar, currentAsset.AssetTypeId);
            Assert.Equal("image/webp", currentAsset.MimeType);
            Assert.Equal(512, currentAsset.Width);
            Assert.Equal(512, currentAsset.Height);
            Assert.True(currentAsset.SizeBytes < sourceBytes.Length);

            var currentContent = await _client.GetByteArrayAsync(
                $"/api/assets/{currentAssetId}/content");
            Assert.Equal("RIFF", System.Text.Encoding.ASCII.GetString(
                currentContent,
                0,
                4));
            Assert.Equal("WEBP", System.Text.Encoding.ASCII.GetString(
                currentContent,
                8,
                4));

            var library = await _client.GetFromJsonAsync<List<AssetResponse>>(
                "/api/assets/me/avatar");
            var sourceAsset = Assert.Single(
                library!,
                asset => asset.OriginalFileName == "avatar-source.png");

            Assert.Equal(AssetTypeIds.Avatar, sourceAsset.AssetTypeId);
            Assert.Equal(sourceAssetId, sourceAsset.Id);
            Assert.Equal("image/png", sourceAsset.MimeType);
            Assert.Equal(sourceBytes.Length, sourceAsset.SizeBytes);
            Assert.NotEqual(currentAssetId, sourceAsset.Id);

            using (var anonymousClient = _factory.CreateClient())
            {
                var publicProfile = await anonymousClient.GetFromJsonAsync<JsonElement>(
                    $"/api/users/{ArcaneLinkApiFactory.OwnerUserId}");
                Assert.False(publicProfile.TryGetProperty(
                    "avatarSourceAssetId",
                    out _));
                Assert.Equal(
                    currentAssetId.ToString(),
                    publicProfile.GetProperty("avatarAssetId").GetString());

                using var deniedSourceResponse = await anonymousClient.GetAsync(
                    $"/api/assets/{sourceAsset.Id}/content");
                Assert.Equal(HttpStatusCode.NotFound, deniedSourceResponse.StatusCode);

                using var publicCurrentResponse = await anonymousClient.GetAsync(
                    $"/api/assets/{currentAssetId}/content");
                Assert.Equal(HttpStatusCode.OK, publicCurrentResponse.StatusCode);
            }

            var reuseResponse = await _client.PostAsJsonAsync(
                $"/api/users/me/profile/avatar/{sourceAsset.Id}",
                new SetAvatarRequest
                {
                    CropOffsetX = -0.2,
                    CropOffsetY = 0.1,
                    CropZoom = 2
                });
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(reuseResponse);
            var reusedProfile = await reuseResponse.Content
                .ReadFromJsonAsync<OwnUserProfileResponse>();
            var replacementCurrentId = Assert.IsType<Guid>(
                reusedProfile!.AvatarAssetId);

            Assert.NotEqual(currentAssetId, replacementCurrentId);
            Assert.Equal(sourceAsset.Id, reusedProfile.AvatarSourceAssetId);
            Assert.Equal(0, reusedProfile.AvatarCropOffsetX);
            Assert.Equal(0, reusedProfile.AvatarCropOffsetY);
            Assert.Equal(1, reusedProfile.AvatarCropZoom);

            var oldCurrentResponse = await _client.GetAsync(
                $"/api/assets/{currentAssetId}/content");
            Assert.Equal(HttpStatusCode.NotFound, oldCurrentResponse.StatusCode);

            var libraryAfterReuse = await _client
                .GetFromJsonAsync<List<AssetResponse>>("/api/assets/me/avatar");
            Assert.Contains(
                libraryAfterReuse!,
                asset => asset.Id == sourceAsset.Id);

            currentAssetId = replacementCurrentId;
        }
        finally
        {
            if (sourceAssetId != null)
            {
                await _client.DeleteAsync($"/api/assets/{sourceAssetId}");
            }

            if (currentAssetId != null)
            {
                await _client.DeleteAsync($"/api/assets/{currentAssetId}");
            }
        }
    }

    private static MultipartFormDataContent CreateUploadContent(
        byte[] source,
        double cropOffsetX,
        double cropOffsetY,
        double cropZoom)
    {
        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(source);
        file.Headers.ContentType = new("image/png");
        content.Add(file, "File", "avatar-source.png");
        content.Add(new StringContent(
            cropOffsetX.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            "CropOffsetX");
        content.Add(new StringContent(
            cropOffsetY.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            "CropOffsetY");
        content.Add(new StringContent(
            cropZoom.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            "CropZoom");

        return content;
    }

    private static MemoryStream CreateSourcePng()
    {
        using var bitmap = new SKBitmap(new SKImageInfo(
            1024,
            768,
            SKColorType.Rgba8888,
            SKAlphaType.Premul));
        var random = new Random(42);
        var pixels = new SKColor[bitmap.Width * bitmap.Height];

        for (var index = 0; index < pixels.Length; index++)
        {
            pixels[index] = new SKColor(
                (byte)random.Next(256),
                (byte)random.Next(256),
                (byte)random.Next(256),
                255);
        }

        bitmap.Pixels = pixels;

        using var image = SKImage.FromBitmap(bitmap);
        using var png = image.Encode(SKEncodedImageFormat.Png, 100);
        var stream = new MemoryStream();
        png.SaveTo(stream);
        stream.Position = 0;

        return stream;
    }
}
