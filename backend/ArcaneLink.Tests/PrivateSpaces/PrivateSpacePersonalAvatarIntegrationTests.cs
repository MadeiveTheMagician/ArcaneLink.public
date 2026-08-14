using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SkiaSharp;

namespace ArcaneLink.Tests.PrivateSpaces;

public sealed class PrivateSpacePersonalAvatarIntegrationTests
{
    [Fact]
    public async Task UploadReplaceAndReset_KeepOnlyTheCurrentOptimizedWebp()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var direct = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var activeSourceCountBefore = await CountActiveAssetsAsync(
            factory,
            ArcaneLinkApiFactory.OwnerUserId,
            AssetTypeIds.Avatar);

        using var firstUpload = CreateUploadContent(
            CreatePng(SKColors.CornflowerBlue),
            cropOffsetX: 0.2,
            cropOffsetY: -0.1,
            cropZoom: 1.7);
        using var firstResponse = await client.PostAsync(
            AvatarUploadPath(direct.SpaceId),
            firstUpload);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(firstResponse);
        var firstView = (await firstResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
        var firstAssetId = Assert.IsType<Guid>(
            firstView.ViewerSettings.CustomAvatarAssetId);
        AssertNeutralCrop(firstView);

        var firstAsset = await GetAssetAsync(factory, firstAssetId);
        Assert.Equal(
            ArcaneLinkApiFactory.OwnerUserId,
            firstAsset.OwnerUserId);
        Assert.Equal(AssetTypeIds.CurrentAvatar, firstAsset.AssetTypeId);
        Assert.Equal("image/webp", firstAsset.MimeType);
        Assert.Equal(512, firstAsset.Width);
        Assert.Equal(512, firstAsset.Height);
        Assert.Null(firstAsset.DeletedAt);
        Assert.Equal(
            activeSourceCountBefore,
            await CountActiveAssetsAsync(
                factory,
                ArcaneLinkApiFactory.OwnerUserId,
                AssetTypeIds.Avatar));

        var firstBytes = await client.GetByteArrayAsync(
            $"/api/assets/{firstAssetId}/content");
        Assert.Equal(
            "RIFF",
            System.Text.Encoding.ASCII.GetString(firstBytes, 0, 4));
        Assert.Equal(
            "WEBP",
            System.Text.Encoding.ASCII.GetString(firstBytes, 8, 4));

        using var replacementUpload = CreateUploadContent(
            CreatePng(SKColors.MediumPurple),
            cropOffsetX: -0.25,
            cropOffsetY: 0.15,
            cropZoom: 2.1);
        using var replacementResponse = await client.PostAsync(
            AvatarUploadPath(direct.SpaceId),
            replacementUpload);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(
            replacementResponse);
        var replacementView = (await replacementResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
        var replacementAssetId = Assert.IsType<Guid>(
            replacementView.ViewerSettings.CustomAvatarAssetId);
        Assert.NotEqual(firstAssetId, replacementAssetId);
        AssertNeutralCrop(replacementView);

        var deletedFirstAsset = await GetAssetAsync(
            factory,
            firstAssetId);
        Assert.NotNull(deletedFirstAsset.DeletedAt);
        Assert.NotNull(deletedFirstAsset.PhysicalDeletedAt);
        using (var oldContentResponse = await client.GetAsync(
                   $"/api/assets/{firstAssetId}/content"))
        {
            Assert.Equal(
                HttpStatusCode.NotFound,
                oldContentResponse.StatusCode);
        }

        using var resetResponse = await client.PatchAsJsonAsync(
            $"/api/private-spaces/{direct.SpaceId}/settings/me",
            new UpdatePrivateSpacePersonalSettingsRequest
            {
                ClearCustomAvatar = true
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(resetResponse);
        var resetView = (await resetResponse.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
        Assert.Null(resetView.ViewerSettings.CustomAvatarAssetId);
        AssertNeutralCrop(resetView);

        var deletedReplacementAsset = await GetAssetAsync(
            factory,
            replacementAssetId);
        Assert.NotNull(deletedReplacementAsset.DeletedAt);
        Assert.NotNull(deletedReplacementAsset.PhysicalDeletedAt);
        Assert.Equal(
            0,
            await CountActiveAssetsAsync(
                factory,
                ArcaneLinkApiFactory.OwnerUserId,
                AssetTypeIds.CurrentAvatar));
    }

    [Fact]
    public async Task ViewerAvatars_AreIsolatedPerMemberInDirectAndGroup()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var direct = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);

        var ownerAssetId = await UploadAvatarAsync(
            client,
            direct.SpaceId,
            SKColors.DarkOrange);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var memberBefore = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            $"/api/private-spaces/{direct.SpaceId}");
        Assert.NotNull(memberBefore);
        Assert.Null(memberBefore.ViewerSettings.CustomAvatarAssetId);

        var memberAssetId = await UploadAvatarAsync(
            client,
            direct.SpaceId,
            SKColors.SeaGreen);
        Assert.NotEqual(ownerAssetId, memberAssetId);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerAfter = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            $"/api/private-spaces/{direct.SpaceId}");
        Assert.Equal(
            ownerAssetId,
            ownerAfter!.ViewerSettings.CustomAvatarAssetId);

        var group = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        client.AuthorizeWith(await client.LoginAsync("member"));
        var groupMemberAssetId = await UploadAvatarAsync(
            client,
            group.SpaceId,
            SKColors.DeepPink);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var groupOwnerView =
            await client.GetFromJsonAsync<PrivateSpaceResponse>(
                $"/api/private-spaces/{group.SpaceId}");
        Assert.NotNull(groupOwnerView);
        Assert.Null(groupOwnerView.ViewerSettings.CustomAvatarAssetId);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var groupMemberView =
            await client.GetFromJsonAsync<PrivateSpaceResponse>(
                $"/api/private-spaces/{group.SpaceId}");
        Assert.Equal(
            groupMemberAssetId,
            groupMemberView!.ViewerSettings.CustomAvatarAssetId);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using var nonMemberUpload = CreateUploadContent(
            CreatePng(SKColors.Red),
            0,
            0,
            1);
        using var nonMemberResponse = await client.PostAsync(
            AvatarUploadPath(direct.SpaceId),
            nonMemberUpload);
        Assert.Equal(HttpStatusCode.NotFound, nonMemberResponse.StatusCode);
        Assert.Equal(
            0,
            await CountActiveAssetsAsync(
                factory,
                ArcaneLinkApiFactory.OutsiderUserId,
                AssetTypeIds.CurrentAvatar));
    }

    [Fact]
    public async Task InvalidImage_ReturnsBadRequestWithoutCreatingAnAsset()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var direct = await CreateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);

        using var invalidUpload = CreateUploadContent(
            "this is not an image"u8.ToArray(),
            0,
            0,
            1);
        using var response = await client.PostAsync(
            AvatarUploadPath(direct.SpaceId),
            invalidUpload);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            0,
            await CountActiveAssetsAsync(
                factory,
                ArcaneLinkApiFactory.OwnerUserId,
                AssetTypeIds.CurrentAvatar));
        var ownerView = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            $"/api/private-spaces/{direct.SpaceId}");
        Assert.Null(ownerView!.ViewerSettings.CustomAvatarAssetId);
    }

    private static async Task<Guid> UploadAvatarAsync(
        HttpClient client,
        Guid spaceId,
        SKColor color)
    {
        using var upload = CreateUploadContent(
            CreatePng(color),
            0.1,
            -0.1,
            1.4);
        using var response = await client.PostAsync(
            AvatarUploadPath(spaceId),
            upload);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var space = (await response.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
        AssertNeutralCrop(space);
        return Assert.IsType<Guid>(
            space.ViewerSettings.CustomAvatarAssetId);
    }

    private static async Task<PrivateSpaceResponse> CreateSpaceAsync(
        HttpClient client,
        params Guid[] memberUserIds)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                MemberUserIds = memberUserIds
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content
            .ReadFromJsonAsync<PrivateSpaceResponse>())!;
    }

    private static MultipartFormDataContent CreateUploadContent(
        byte[] bytes,
        double cropOffsetX,
        double cropOffsetY,
        double cropZoom)
    {
        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType =
            new MediaTypeHeaderValue("image/png");
        content.Add(file, "File", "viewer-avatar.png");
        content.Add(
            new StringContent(cropOffsetX.ToString(
                CultureInfo.InvariantCulture)),
            "CropOffsetX");
        content.Add(
            new StringContent(cropOffsetY.ToString(
                CultureInfo.InvariantCulture)),
            "CropOffsetY");
        content.Add(
            new StringContent(cropZoom.ToString(
                CultureInfo.InvariantCulture)),
            "CropZoom");
        return content;
    }

    private static byte[] CreatePng(SKColor color)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(
            640,
            480,
            SKColorType.Rgba8888,
            SKAlphaType.Premul));
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(color);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    private static void AssertNeutralCrop(PrivateSpaceResponse response)
    {
        Assert.Equal(0, response.ViewerSettings.CustomAvatarCropOffsetX);
        Assert.Equal(0, response.ViewerSettings.CustomAvatarCropOffsetY);
        Assert.Equal(1, response.ViewerSettings.CustomAvatarCropZoom);
    }

    private static async Task<AssetSnapshot> GetAssetAsync(
        ArcaneLinkApiFactory factory,
        Guid assetId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Assets
            .AsNoTracking()
            .Where(asset => asset.Id == assetId)
            .Select(asset => new AssetSnapshot(
                asset.OwnerUserId,
                asset.AssetTypeId,
                asset.MimeType,
                asset.Width,
                asset.Height,
                asset.DeletedAt,
                asset.PhysicalDeletedAt))
            .SingleAsync();
    }

    private static async Task<int> CountActiveAssetsAsync(
        ArcaneLinkApiFactory factory,
        Guid ownerUserId,
        Guid assetTypeId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Assets.CountAsync(asset =>
            asset.OwnerUserId == ownerUserId &&
            asset.AssetTypeId == assetTypeId &&
            asset.DeletedAt == null);
    }

    private static string AvatarUploadPath(Guid spaceId) =>
        $"/api/private-spaces/{spaceId}/settings/me/avatar/upload";

    private sealed record AssetSnapshot(
        Guid? OwnerUserId,
        Guid AssetTypeId,
        string MimeType,
        int? Width,
        int? Height,
        DateTime? DeletedAt,
        DateTime? PhysicalDeletedAt);
}
