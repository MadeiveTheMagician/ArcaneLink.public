using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.Extensions;
using ArcaneLink.Hubs;
using ArcaneLink.Middleware;
using ArcaneLink.Observability.HealthChecks;
using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Assets.Abstractions;
using ArcaneLink.Services.Assets.Storage;
using ArcaneLink.Services.Assets.Storage.Abstractions;
using ArcaneLink.Services.Auth;
using ArcaneLink.Services.Auth.Abstraction;
using ArcaneLink.Services.Email;
using ArcaneLink.Services.Email.Abstractions;
using ArcaneLink.Services.JwtService;
using ArcaneLink.Services.JwtService.Abstariction;
using ArcaneLink.Services.Login;
using ArcaneLink.Services.Login.Abstractions;
using ArcaneLink.Services.Logout;
using ArcaneLink.Services.Logout.Abstraction;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.Messages.Abstractions;
using ArcaneLink.Services.Moderation;
using ArcaneLink.Services.Moderation.Abstractions;
using ArcaneLink.Services.Notifications;
using ArcaneLink.Services.Notifications.Abstractions;
using ArcaneLink.Services.PrivateSpaces;
using ArcaneLink.Services.PrivateSpaces.Abstractions;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Request;
using ArcaneLink.Services.RequestInfo.Abstractions;
using ArcaneLink.Services.Retention;
using ArcaneLink.Services.Servers;
using ArcaneLink.Services.Servers.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Services.Servers.Authorization.Abstractions;
using ArcaneLink.Services.Spaces;
using ArcaneLink.Services.Spaces.Abstractions;
using ArcaneLink.Services.Streaming;
using ArcaneLink.Services.Users;
using ArcaneLink.Services.Users.Abstractions;
using ArcaneLink.Services.Validators;
using ArcaneLink.Services.Voice;
using ArcaneLink.Services.Voice.Abstractions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
const long maxMultipartRequestSizeBytes = 12 * 1024 * 1024;

builder.Configuration.AddJsonFile(
    "storage-policy.json",
    optional: false,
    reloadOnChange: true);
builder.Configuration.AddEnvironmentVariables();

builder.Logging.AddArcaneLinkLogging(builder.Environment);

builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();
builder.Services.AddOpenApi();
builder.Services.AddSignalR();
builder.Services.AddArcaneLinkRateLimiting(builder.Configuration);
builder.Services.AddArcaneLinkSecurityHardening(builder.Configuration);
var dataProtection = builder.Services
    .AddDataProtection()
    .SetApplicationName("ArcaneLink");
var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    var absoluteDataProtectionKeysPath = Path.GetFullPath(dataProtectionKeysPath);
    Directory.CreateDirectory(absoluteDataProtectionKeysPath);
    dataProtection.PersistKeysToFileSystem(
        new DirectoryInfo(absoluteDataProtectionKeysPath));
}
builder.Services.Configure<AssetUploadOptions>(
    builder.Configuration.GetSection(AssetUploadOptions.SectionName));
builder.Services.Configure<AssetCleanupOptions>(
    builder.Configuration.GetSection(AssetCleanupOptions.SectionName));
builder.Services.Configure<DataRetentionOptions>(
    builder.Configuration.GetSection(DataRetentionOptions.SectionName));
builder.Services.Configure<StreamingOptions>(
    builder.Configuration.GetSection(StreamingOptions.SectionName));
builder.Services
    .AddOptions<TurnCredentialsOptions>()
    .Bind(builder.Configuration.GetSection(TurnCredentialsOptions.SectionName))
    .Validate(
        static options => options.HasValidConfiguration(),
        "TurnCredentials is enabled but its shared secret, TTL, or TURN URLs are invalid.")
    .ValidateOnStart();
builder.Services
    .AddOptions<ServerAuthorizationShadowOptions>()
    .Bind(builder.Configuration.GetSection(
        ServerAuthorizationShadowOptions.SectionName))
    .Validate(
        static options => options.HasValidEnforcementConfiguration(),
        "AuthorizationShadow:EnforcedPermissionCodes contains an unsupported permission code.")
    .ValidateOnStart();
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = maxMultipartRequestSizeBytes;
});
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = maxMultipartRequestSizeBytes;
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
builder.Services
    .AddOptions<EmailDeliveryOptions>()
    .Bind(builder.Configuration.GetSection(EmailDeliveryOptions.SectionName))
    .Validate(static options => options.IsValid(), "Email delivery configuration is invalid.")
    .ValidateOnStart();
builder.Services
    .AddOptions<EmailOutboxOptions>()
    .Bind(builder.Configuration.GetSection(EmailOutboxOptions.SectionName))
    .Validate(static options => options.IsValid(), "Email outbox configuration is invalid.")
    .ValidateOnStart();
ProductionConfigurationValidator.Validate(builder.Configuration, builder.Environment);
builder.Services
    .AddHealthChecks()
    .AddCheck(
        "self",
        () => HealthCheckResult.Healthy("Backend process is alive."),
        tags: ["live"])
    .AddCheck<DatabaseHealthCheck>(
        "database",
        tags: ["ready"])
    .AddCheck<StorageHealthCheck>(
        "storage",
        tags: ["ready"])
    .AddCheck<JwtSettingsHealthCheck>(
        "jwt",
        tags: ["ready"])
    .AddCheck<DataProtectionKeysHealthCheck>(
        "data_protection",
        tags: ["ready"])
    .AddCheck<MigrationsHealthCheck>(
        "migrations",
        tags: ["ready"])
    .AddCheck<SignalRHealthCheck>(
        "signalr",
        tags: ["ready"]);

builder.Services.AddSingleton<ServerSpaceRealtimeAudienceCache>();
builder.Services.AddSingleton<RealtimeConnectionRegistry>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ITurnCredentialService, TurnCredentialService>();
builder.Services
    .AddOptions<RealtimePresenceOptions>()
    .Bind(builder.Configuration.GetSection(RealtimePresenceOptions.SectionName))
    .Validate(
        options => options.DisconnectGraceSeconds is >= 0 and <= 300,
        "Realtime presence disconnect grace must be between 0 and 300 seconds.")
    .ValidateOnStart();
builder.Services.AddSingleton<IUserPresenceCoordinator, UserPresenceCoordinator>();

// ---------------------- Scoped services BEGIN ---------------------- // 


builder.Services.AddScoped<ILoginService, LoginService>();
builder.Services.AddScoped<IUserValidationService, UserValidationService>();
builder.Services.AddScoped<IUserProfileService, UserProfileService>();
builder.Services.AddScoped<IUserDiscoveryService, UserDiscoveryService>();
builder.Services.AddScoped<IUserProfileSettingsService, UserProfileSettingsService>();
builder.Services.AddScoped<IDirectMessagePrivacyService, DirectMessagePrivacyService>();
builder.Services.AddScoped<IUserPresencePolicyService, UserPresencePolicyService>();
builder.Services.AddScoped<IUserProfileTagService, UserProfileTagService>();
builder.Services.AddScoped<IUserProfileAssetService, UserProfileAssetService>();
builder.Services.AddScoped<AvatarImageProcessor>();
builder.Services.AddScoped<IFriendService, FriendService>();
builder.Services.AddScoped<IUserPasswordService, UserPasswordService>();
builder.Services.AddScoped<PasswordValidator>();
builder.Services.AddScoped<IUserRegistrationService, UserRegistrationService>();
builder.Services.AddScoped<IJwtTokenService, JwtService>();
builder.Services.AddScoped<IAuthTokenService, AuthTokenService>();
builder.Services.AddScoped<IAccountLifecycleService, AccountLifecycleService>();
builder.Services.AddScoped<IEmailSender, MailKitEmailSender>();
builder.Services.AddScoped<IEmailOutboxQueue, EmailOutboxQueue>();
builder.Services.AddScoped<EmailOutboxProcessor>();
builder.Services.AddSingleton<IEmailTemplateRenderer, FileEmailTemplateRenderer>();
builder.Services.AddScoped<IUserDeviceSessionService, UserDeviceSessionService>();
builder.Services.AddScoped<IAssetService, AssetService>();
builder.Services.AddScoped<IAssetAccessPolicy, AssetAccessPolicy>();
builder.Services.AddScoped<IAssetStorageService, LocalAssetStorageService>();
builder.Services.AddScoped<AssetCleanupRunner>();
builder.Services.AddScoped<IRequestInfoService, RequestInfoService>();
builder.Services.AddScoped<IRealtimeNotificationService, RealtimeNotificationService>();
builder.Services.AddScoped<IUserPresenceAudienceService, UserPresenceAudienceService>();
builder.Services.AddScoped<ServerSpaceRealtimeAudienceService>();
builder.Services.AddScoped<RealtimeServerGroupMembershipService>();
builder.Services.AddScoped<IVoiceConnectionService, VoiceConnectionService>();
builder.Services.AddScoped<ServerVoiceAccessReconciliationService>();
builder.Services.AddScoped<PrivateVoiceAccessReconciliationService>();
builder.Services.AddScoped<ILogoutService, LogoutService>();
builder.Services.AddScoped<IServerCommandService, ServerCommandService>();
builder.Services.AddScoped<IServerQueryService, ServerQueryService>();
builder.Services.AddScoped<IServerDiscoveryService, ServerDiscoveryService>();
builder.Services.AddScoped<ServerLastMessageQueryService>();
builder.Services.AddScoped<ServerConfigurationValidator>();
builder.Services.AddScoped<IServerMemberService, ServerMemberService>();
builder.Services.AddScoped<IServerMemberDisplayColorService, ServerMemberDisplayColorService>();
builder.Services.AddScoped<IServerMemberProfileService, ServerMemberProfileService>();
builder.Services.AddScoped<IServerGovernanceService, ServerGovernanceService>();
builder.Services.AddScoped<IServerGovernanceAccessService, ServerGovernanceAccessService>();
builder.Services.AddScoped<ServerPermissionRealtimeAudienceService>();
builder.Services.AddSingleton<LegacyServerPermissionMaskAdapter>();
builder.Services.AddSingleton<LegacySpacePermissionMaskAdapter>();
builder.Services.AddSingleton<ServerAuthorizationContextCache>();
builder.Services.AddScoped<IServerAuthorizationRuntime, ServerAuthorizationRuntime>();
builder.Services.AddScoped<IServerInviteService, ServerInviteService>();
builder.Services.AddScoped<IServerInviteQueryService, ServerInviteQueryService>();
builder.Services.AddScoped<IServerInviteAcceptanceService, ServerInviteAcceptanceService>();
builder.Services.AddScoped<ServerInviteEligibilityService>();
builder.Services.AddScoped<IServerJoinRequestService, ServerJoinRequestService>();
builder.Services.AddScoped<IServerOwnershipService, ServerOwnershipService>();
builder.Services.AddScoped<IServerRoleService, ServerRoleService>();
builder.Services.AddScoped<IServerAuditLogService, ServerAuditLogService>();
builder.Services.AddScoped<ISpaceService, SpaceService>();
builder.Services.AddScoped<ISpaceQueryService, SpaceQueryService>();
builder.Services.AddScoped<ISpaceCommandService, SpaceCommandService>();
builder.Services.AddScoped<ISpaceReorderService, SpaceReorderService>();
builder.Services.AddScoped<ISpacePermissionOverrideService, SpacePermissionOverrideService>();
builder.Services.AddScoped<ISpaceAuthorizationService, SpaceAuthorizationService>();
builder.Services.AddScoped<IPrivateSpaceService, PrivateSpaceService>();
builder.Services.AddScoped<IPrivateSpaceFolderService, PrivateSpaceFolderService>();
builder.Services.AddScoped<IPrivateSpaceMembershipService, PrivateSpaceMembershipService>();
builder.Services.AddScoped<IPrivateSpaceMessageService, PrivateSpaceMessageService>();
builder.Services.AddScoped<PrivateSpaceAccessService>();
builder.Services.AddScoped<PrivateSpaceActivityService>();
builder.Services.AddScoped<PrivateSpaceHistoryService>();
builder.Services.AddScoped<PrivateSpacePersonalAvatarService>();
builder.Services.AddScoped<PrivateSpaceRealtimeNotifier>();
builder.Services.AddScoped<PrivateMessageTrashCleanupRunner>();
builder.Services.AddScoped<SpaceValidationService>();
builder.Services.AddScoped<SpaceRealtimeNotifier>();
builder.Services.AddScoped<ISpaceMessageService, SpaceMessageService>();
builder.Services.AddScoped<ISpaceMessageQueryService, SpaceMessageQueryService>();
builder.Services.AddScoped<ISpaceMessageCommandService, SpaceMessageCommandService>();
builder.Services.AddScoped<ISpaceMessageAttachmentService, SpaceMessageAttachmentService>();
builder.Services.AddScoped<SpaceMessageAccessService>();
builder.Services.AddScoped<SpaceMessageMentionService>();
builder.Services.AddScoped<SpaceMessageNotifier>();
builder.Services.AddScoped<MessageReactionService>();
builder.Services.AddScoped<UnreadCountService>();
builder.Services.AddScoped<SpaceReadStateService>();
builder.Services.AddScoped<IModerationService, ModerationService>();
builder.Services.AddScoped<IUserNotificationService, UserNotificationService>();
builder.Services.AddHostedService<AssetCleanupHostedService>();
builder.Services.AddHostedService<PrivateMessageTrashCleanupHostedService>();
builder.Services.AddHostedService<EmailOutboxHostedService>();

// ----------------------- Scoped services END ---------------------- //


builder.Services.AddJwtAuthentication(builder.Configuration);


var app = builder.Build();

// Validate the packaged Russian email copy before the application begins
// accepting registrations or account-recovery requests.
_ = app.Services.GetRequiredService<IEmailTemplateRenderer>();

app.UseForwardedHeaders();
app.UseMiddleware<SecurityHeadersMiddleware>();

if (app.Environment.IsProduction())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Docker"))
{
    app.MapOpenApi();
    app.MapScalarApiReference();
    app.MapGet("/", () => Results.Redirect("/scalar"))
       .ExcludeFromDescription();
}

app.MapGet("/ping", () => "pong")
   .WithName("Ping");
app.MapHealthChecks(
    "/health/live",
    new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("live"),
        ResponseWriter = HealthCheckResponseWriter.WriteJsonAsync
    });
app.MapHealthChecks(
    "/health/ready",
    new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = HealthCheckResponseWriter.WriteJsonAsync
    });
app.UseMiddleware<CorrelationMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapHub<RealtimeHub>("/hubs/realtime")
    .RequireRateLimiting(AbuseRateLimitPolicyNames.SignalRConnect);
app.MapControllers();

app.Run();

public partial class Program;
