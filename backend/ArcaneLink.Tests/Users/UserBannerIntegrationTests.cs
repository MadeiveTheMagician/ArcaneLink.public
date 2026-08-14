using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Users;

public sealed class UserBannerIntegrationTests
{
    private static readonly byte[] BannerPng = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=");

    [Fact]
    public async Task BannerLibrary_CanUploadClearReuseAndDeleteCurrentBanner()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        using var uploadContent = CreateBannerUploadContent();
        using var uploadResponse = await client.PostAsync(
            "/api/users/me/profile/banner/upload",
            uploadContent);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(uploadResponse);
        var uploadedProfile = await uploadResponse.Content
            .ReadFromJsonAsync<OwnUserProfileResponse>();
        var bannerAssetId = Assert.IsType<Guid>(uploadedProfile?.BannerAssetId);

        var library = await client.GetFromJsonAsync<List<AssetResponse>>(
            "/api/assets/me/banner");
        Assert.Contains(library!, asset => asset.Id == bannerAssetId);

        using var clearResponse = await client.DeleteAsync(
            "/api/users/me/profile/banner");
        clearResponse.EnsureSuccessStatusCode();
        var clearedProfile = await clearResponse.Content
            .ReadFromJsonAsync<OwnUserProfileResponse>();
        Assert.Null(clearedProfile?.BannerAssetId);

        var libraryAfterClear = await client.GetFromJsonAsync<List<AssetResponse>>(
            "/api/assets/me/banner");
        Assert.Contains(libraryAfterClear!, asset => asset.Id == bannerAssetId);

        using var reuseResponse = await client.PostAsync(
            $"/api/users/me/profile/banner/{bannerAssetId}",
            content: null);
        reuseResponse.EnsureSuccessStatusCode();
        var reusedProfile = await reuseResponse.Content
            .ReadFromJsonAsync<OwnUserProfileResponse>();
        Assert.Equal(bannerAssetId, reusedProfile?.BannerAssetId);

        using var deleteResponse = await client.DeleteAsync(
            $"/api/assets/{bannerAssetId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var profileAfterDelete = await client
            .GetFromJsonAsync<OwnUserProfileResponse>("/api/users/me/profile");
        Assert.Null(profileAfterDelete?.BannerAssetId);
    }

    [Fact]
    public async Task BannerUpload_RejectsEleventhActiveAsset()
    {
        using var factory = new ArcaneLinkApiFactory();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Assets.AddRange(Enumerable.Range(0, 10).Select(index =>
                new Asset
                {
                    Id = Guid.NewGuid(),
                    OwnerUserId = ArcaneLinkApiFactory.OwnerUserId,
                    AssetTypeId = AssetTypeIds.Banner,
                    StorageKey = $"tests/banner-limit/{index}.png",
                    OriginalFileName = $"banner-{index}.png",
                    MimeType = "image/png",
                    SizeBytes = BannerPng.Length,
                    Sha256 = new string((char)('a' + index), 64),
                    CreatedAt = DateTime.UtcNow.AddSeconds(index)
                }));
            await db.SaveChangesAsync();
        }

        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var uploadContent = CreateBannerUploadContent();
        using var response = await client.PostAsync(
            "/api/users/me/profile/banner/upload",
            uploadContent);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static MultipartFormDataContent CreateBannerUploadContent()
    {
        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(BannerPng);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(file, "File", "profile-banner.png");
        return content;
    }
}
