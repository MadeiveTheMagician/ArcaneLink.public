using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Assets;

public sealed class AssetSecurityIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly ArcaneLinkApiFactory _factory;
    private readonly HttpClient _client;

    public AssetSecurityIntegrationTests(ArcaneLinkApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task LegacyMetadataCreation_CannotReferenceOrDeleteProviderKey()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));

        var storageRoot = Path.GetFullPath(_factory.AssetStorageRootPath);
        var siblingStorageRoot = $"{storageRoot}-victim";
        var victimPath = Path.Combine(siblingStorageRoot, "victim.txt");
        Directory.CreateDirectory(siblingStorageRoot);
        await File.WriteAllTextAsync(victimPath, "must remain");

        using var createResponse = await _client.PostAsJsonAsync(
            "/api/assets",
            new
            {
                assetTypeId = AssetTypeIds.Other,
                storageKey = "../storage-victim/victim.txt",
                mimeType = "text/plain",
                sizeBytes = 11,
                sha256 = new string('A', 64)
            });

        if (createResponse.StatusCode == HttpStatusCode.Created)
        {
            var created = await createResponse.Content.ReadFromJsonAsync<JsonObject>();
            var assetId = created?["id"]?.GetValue<Guid>();

            if (assetId.HasValue)
            {
                using var deleteResponse = await _client.DeleteAsync(
                    $"/api/assets/{assetId.Value}");
                deleteResponse.EnsureSuccessStatusCode();
            }
        }

        Assert.Equal(HttpStatusCode.Gone, createResponse.StatusCode);
        Assert.True(
            File.Exists(victimPath),
            "A client-supplied provider key must never delete a sibling storage file.");
    }

    [Fact]
    public async Task MultipartUpload_HidesProviderKeyAndPreservesOwnerLifecycle()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));

        using var form = new MultipartFormDataContent();
        form.Add(
            new StringContent(AssetTypeIds.Other.ToString()),
            "AssetTypeId");
        using var fileContent = new ByteArrayContent(
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "File", "safe.png");

        using var uploadResponse = await _client.PostAsync(
            "/api/assets/upload",
            form);
        uploadResponse.EnsureSuccessStatusCode();

        var uploaded = await uploadResponse.Content.ReadFromJsonAsync<JsonObject>();
        var assetId = uploaded?["id"]?.GetValue<Guid>();
        Assert.True(assetId.HasValue);
        Assert.False(
            uploaded!.ContainsKey("storageKey"),
            "Provider storage keys must not be serialized in asset responses.");

        using var metadataResponse = await _client.GetAsync(
            $"/api/assets/{assetId.Value}");
        metadataResponse.EnsureSuccessStatusCode();
        var metadata = await metadataResponse.Content.ReadFromJsonAsync<JsonObject>();
        Assert.False(metadata!.ContainsKey("storageKey"));

        using var contentResponse = await _client.GetAsync(
            $"/api/assets/{assetId.Value}/content");
        contentResponse.EnsureSuccessStatusCode();
        Assert.Equal(
            "image/png",
            contentResponse.Content.Headers.ContentType?.MediaType);
        Assert.Contains(
            "public",
            contentResponse.Headers.CacheControl?.ToString() ?? string.Empty,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains(
            "immutable",
            contentResponse.Headers.CacheControl?.ToString() ?? string.Empty,
            StringComparison.OrdinalIgnoreCase);

        using var deleteResponse = await _client.DeleteAsync(
            $"/api/assets/{assetId.Value}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        using var deletedContentResponse = await _client.GetAsync(
            $"/api/assets/{assetId.Value}/content");
        Assert.Equal(HttpStatusCode.NotFound, deletedContentResponse.StatusCode);
    }
}
