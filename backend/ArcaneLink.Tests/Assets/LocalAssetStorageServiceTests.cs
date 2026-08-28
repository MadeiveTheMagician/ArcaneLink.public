using ArcaneLink.Services.Assets.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace ArcaneLink.Tests.Assets;

public sealed class LocalAssetStorageServiceTests
{
    [Fact]
    public async Task DeleteAsync_RejectsSiblingPathWithStorageRootPrefix()
    {
        var contentRoot = Path.Combine(
            Path.GetTempPath(),
            "ArcaneLink.Tests",
            Guid.NewGuid().ToString("N"));
        var siblingStorageRoot = Path.Combine(contentRoot, "storage-victim");
        var victimPath = Path.Combine(siblingStorageRoot, "victim.txt");

        try
        {
            Directory.CreateDirectory(siblingStorageRoot);
            await File.WriteAllTextAsync(victimPath, "must remain");
            var service = new LocalAssetStorageService(
                new TestWebHostEnvironment(contentRoot));

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => service.DeleteAsync("../storage-victim/victim.txt"));

            Assert.True(File.Exists(victimPath));
        }
        finally
        {
            if (Directory.Exists(contentRoot))
            {
                Directory.Delete(contentRoot, recursive: true);
            }
        }
    }

    private sealed class TestWebHostEnvironment : IWebHostEnvironment
    {
        public TestWebHostEnvironment(string contentRootPath)
        {
            this.ContentRootPath = contentRootPath;
        }

        public string ApplicationName { get; set; } = "ArcaneLink.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Testing";
        public string ContentRootPath { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
