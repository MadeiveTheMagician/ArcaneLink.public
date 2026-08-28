using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Assets.Storage;
using ArcaneLink.Services.Assets.Storage.Abstractions;
using ArcaneLink.Services.PrivateSpaces;
using ArcaneLink.Services.Email;
using ArcaneLink.Services.RequestInfo.Abstractions;
using ArcaneLink.Services.Realtime.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace ArcaneLink.Tests.Infrastructure;

public sealed class ArcaneLinkApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly string _testContentRoot = Path.Combine(
        Path.GetTempPath(),
        "ArcaneLink.Tests",
        Guid.NewGuid().ToString("N"));
    private bool _isSeeded;
    private readonly Action<IServiceCollection>? _configureAdditionalServices;

    public ArcaneLinkApiFactory()
    {
    }

    internal ArcaneLinkApiFactory(Action<IServiceCollection> configureAdditionalServices)
    {
        _configureAdditionalServices = configureAdditionalServices;
    }

    public string AssetStorageRootPath =>
        Path.Combine(_testContentRoot, "storage");

    public static readonly Guid OwnerUserId =
        Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    public static readonly Guid MemberUserId =
        Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");
    public static readonly Guid OutsiderUserId =
        Guid.Parse("aaaaaaaa-0000-0000-0000-000000000003");
    public static readonly Guid ServerId =
        Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
    public static readonly Guid OwnerMemberId =
        Guid.Parse("cccccccc-0000-0000-0000-000000000001");
    public static readonly Guid MemberMemberId =
        Guid.Parse("cccccccc-0000-0000-0000-000000000002");
    public static readonly Guid TextSpaceId =
        Guid.Parse("dddddddd-0000-0000-0000-000000000001");

    public const string Password = "TestPass123!";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Data Source=:memory:",
                ["JwtSettings:Issuer"] = "ArcaneLink",
                ["JwtSettings:Audience"] = "ArcaneLinkClient",
                ["JwtSettings:SecretKey"] = "CHANGE_ME_SUPER_SECRET_KEY_MINIMUM_32_CHARS",
                ["JwtSettings:AccessTokenExpirationMinutes"] = "60",
                ["JwtSettings:RefreshTokenExpirationDays"] = "180",
                ["JwtSettings:DeviceSessionIdleExpirationDays"] = "180",
                ["JwtSettings:DeviceSessionAbsoluteExpirationDays"] = "365",
                ["DataProtection:KeysPath"] = Path.Combine(
                    _testContentRoot,
                    "data-protection-keys")
            });
        });
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDatabaseProvider>();
            services.RemoveAll<IRequestInfoService>();
            services.RemoveAll<IRealtimeNotificationService>();
            services.RemoveAll<IAssetStorageService>();
            RemoveDbContextConfigurationServices(services);
            RemoveProviderServices(services, "Npgsql");
            RemoveHostedService<AssetCleanupHostedService>(services);
            RemoveHostedService<PrivateMessageTrashCleanupHostedService>(services);
            RemoveHostedService<EmailOutboxHostedService>(services);

            _connection.Open();

            services.AddDbContext<AppDbContext>(options =>
                options.UseSqlite(_connection));
            services.AddScoped<IRequestInfoService, TestRequestInfoService>();
            services.AddScoped<IRealtimeNotificationService, NoOpRealtimeNotificationService>();
            services.AddScoped<IAssetStorageService>(_ =>
                new LocalAssetStorageService(
                    new TestAssetStorageEnvironment(_testContentRoot)));
            _configureAdditionalServices?.Invoke(services);
        });
    }

    private static void RemoveDbContextConfigurationServices(IServiceCollection services)
    {
        for (var index = services.Count - 1; index >= 0; index--)
        {
            var serviceType = services[index].ServiceType;
            if (serviceType.IsGenericType &&
                serviceType.GenericTypeArguments.Contains(typeof(AppDbContext)) &&
                serviceType.Name.Contains("DbContextOptions", StringComparison.Ordinal))
            {
                services.RemoveAt(index);
            }
        }
    }

    private static void RemoveProviderServices(IServiceCollection services, string providerName)
    {
        for (var index = services.Count - 1; index >= 0; index--)
        {
            var descriptor = services[index];
            if (IsProviderService(descriptor, providerName))
            {
                services.RemoveAt(index);
            }
        }
    }

    private static bool IsProviderService(ServiceDescriptor descriptor, string providerName)
    {
        return IsProviderType(descriptor.ServiceType, providerName) ||
               IsProviderType(descriptor.ImplementationType, providerName) ||
               IsProviderType(descriptor.ImplementationInstance?.GetType(), providerName);
    }

    private static bool IsProviderType(Type? type, string providerName)
    {
        return type?.Assembly.GetName().Name?.Contains(
            providerName,
            StringComparison.OrdinalIgnoreCase) == true;
    }

    private static void RemoveHostedService<THostedService>(
        IServiceCollection services)
    {
        for (var index = services.Count - 1; index >= 0; index--)
        {
            var descriptor = services[index];
            if (descriptor.ServiceType == typeof(IHostedService) &&
                descriptor.ImplementationType == typeof(THostedService))
            {
                services.RemoveAt(index);
            }
        }
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        if (!_isSeeded)
        {
            using var scope = host.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            db.Database.EnsureDeleted();
            db.Database.EnsureCreated();
            Seed(db);
            _isSeeded = true;
        }

        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection.Dispose();

        if (disposing)
        {
            DeleteTestContentRoot();
        }
    }

    private void DeleteTestContentRoot()
    {
        if (!Directory.Exists(_testContentRoot))
        {
            return;
        }

        var tempRoot = Path.GetFullPath(Path.GetTempPath());
        var targetRoot = Path.GetFullPath(_testContentRoot);
        var relativeTarget = Path.GetRelativePath(tempRoot, targetRoot);

        if (Path.IsPathRooted(relativeTarget) ||
            relativeTarget.Equals("..", StringComparison.Ordinal) ||
            relativeTarget.StartsWith(
                $"..{Path.DirectorySeparatorChar}",
                StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Refusing to delete a test content root outside the system temp directory.");
        }

        Directory.Delete(targetRoot, recursive: true);
    }

    private static void Seed(AppDbContext db)
    {
        var now = DateTime.UtcNow;
        var owner = CreateUser(OwnerUserId, "owner", "Owner", "owner@example.test", now);
        var member = CreateUser(MemberUserId, "member", "Member", "member@example.test", now);
        var outsider = CreateUser(OutsiderUserId, "outsider", "Outsider", "outsider@example.test", now);

        db.Users.AddRange(owner, member, outsider);
        db.UserProfiles.AddRange(
            CreateProfile(owner, "Owner", now),
            CreateProfile(member, "Member", now),
            CreateProfile(outsider, "Outsider", now));
        db.UserProfileSettings.AddRange(
            CreateProfileSettings(owner.Id, now),
            CreateProfileSettings(member.Id, now),
            CreateProfileSettings(outsider.Id, now));

        var server = new Server
        {
            Id = ServerId,
            CreatedByUserId = owner.Id,
            OwnerUserId = owner.Id,
            Slug = "test-server",
            Title = "Test Server",
            Description = "Integration test server",
            DefaultTextSpaceId = null,
            AccessMode = ServerAccessModeCodes.Private,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        var ownerMember = CreateMember(OwnerMemberId, owner.Id, now);
        var memberMember = CreateMember(MemberMemberId, member.Id, now);
        var textSpace = new Space
        {
            Id = TextSpaceId,
            ServerId = ServerId,
            TypeId = SpaceIds.TypeTextRoom,
            CreatedByUserId = owner.Id,
            Title = "general",
            Position = 0,
            IsSystem = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Servers.Add(server);
        db.ServerMembers.AddRange(ownerMember, memberMember);
        db.SaveChanges();

        db.Spaces.Add(textSpace);
        db.SaveChanges();

        server.DefaultTextSpaceId = TextSpaceId;
        db.SaveChanges();
    }

    private static User CreateUser(
        Guid id,
        string login,
        string displayName,
        string email,
        DateTime now)
    {
        var user = new User
        {
            Id = id,
            Login = login,
            LoginNorm = login.ToUpperInvariant(),
            Email = email,
            EmailNorm = email.ToUpperInvariant(),
            PasswordHash = string.Empty,
            StatusId = UserStatusIds.Active,
            EmailConfirmedAt = now,
            CreatedAt = now
        };
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, Password);
        return user;
    }

    private static UserProfile CreateProfile(User user, string displayName, DateTime now)
    {
        return new UserProfile
        {
            UserId = user.Id,
            DisplayName = displayName,
            DisplayNameNorm = displayName.ToUpperInvariant(),
            UpdatedAt = now
        };
    }

    private static UserProfileSettings CreateProfileSettings(Guid userId, DateTime now)
    {
        return new UserProfileSettings
        {
            UserId = userId,
            InterfaceScale = 1,
            FontScale = 1,
            ServerInterfaceScale = 1,
            IsServerRailPinned = true,
            ShowPrivateReadAllButton = true,
            IsAllPrivateSpaceOrderLocked = false,
            ServerMessageDisplayFormat =
                MessageDisplayFormatCodes.WallScroll,
            PrivateMessageDisplayFormat =
                MessageDisplayFormatCodes.WallScroll,
            ServerMessageBubbleAlignment =
                MessageBubbleAlignmentCodes.OwnRight,
            PrivateMessageBubbleAlignment =
                MessageBubbleAlignmentCodes.OwnRight,
            ServerMessageBubbleWidth =
                MessageBubbleWidthCodes.Standard,
            PrivateMessageBubbleWidth =
                MessageBubbleWidthCodes.Standard,
            SelectedThemeId = SystemThemeIds.Sapphire,
            ProfileColor = null,
            ApplySystemThemeToOtherProfiles = true,
            PresenceVisibility = PresenceVisibilityCodes.Everyone,
            ShowLastSeen = true,
            PresenceMode = PresenceModeCodes.Automatic,
            UpdatedAt = now
        };
    }

    private static ServerMember CreateMember(Guid memberId, Guid userId, DateTime now)
    {
        return new ServerMember
        {
            Id = memberId,
            ServerId = ServerId,
            UserId = userId,
            StatusId = ServerMemberStatusIds.Active,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private sealed class NoOpRealtimeNotificationService : IRealtimeNotificationService
    {
        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class TestRequestInfoService : IRequestInfoService
    {
        public string GetClientIpAddress()
        {
            return "127.0.0.1";
        }

        public string GetClientDeviceInfo()
        {
            return "integration-test";
        }

        public string GetUserAgent()
        {
            return "ArcaneLink.Tests";
        }
    }

    private sealed class TestAssetStorageEnvironment : IWebHostEnvironment
    {
        public TestAssetStorageEnvironment(string contentRootPath)
        {
            ContentRootPath = contentRootPath;
        }

        public string ApplicationName { get; set; } = "ArcaneLink.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Testing";
        public string ContentRootPath { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
