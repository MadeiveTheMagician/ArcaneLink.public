using System.Text;
using ArcaneLink.Configuration;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.Services.JwtService;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ArcaneLink.Extensions
{
    public static class AuthenticationExtensions
    {
        public static IServiceCollection AddJwtAuthentication(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            var jwtSettings = configuration
                .GetSection("JwtSettings")
                .Get<JwtSettings>()
                ?? throw new InvalidOperationException("JwtSettings section is missing.");

            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = jwtSettings.Issuer,

                        ValidateAudience = true,
                        ValidAudience = jwtSettings.Audience,

                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),

                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.Zero
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;

                            if (!string.IsNullOrEmpty(accessToken) &&
                                path.StartsWithSegments("/hubs/realtime"))
                            {
                                context.Token = accessToken;
                            }
                            else if (!context.Request.Headers.ContainsKey("Authorization") &&
                                     (HttpMethods.IsGet(context.Request.Method) ||
                                      HttpMethods.IsHead(context.Request.Method)) &&
                                     path.StartsWithSegments("/api/assets") &&
                                     context.Request.Cookies.TryGetValue(
                                         AuthCookieNames.AssetAccessToken,
                                         out var assetAccessToken) &&
                                     !string.IsNullOrWhiteSpace(assetAccessToken))
                            {
                                context.Token = assetAccessToken;
                            }

                            return Task.CompletedTask;
                        },
                        OnTokenValidated = async context =>
                        {
                            var userIdValue = context.Principal?.FindFirst("userId")?.Value;
                            var deviceSessionIdValue = context.Principal?.FindFirst("deviceSessionId")?.Value;

                            if (!Guid.TryParse(userIdValue, out var userId) ||
                                !Guid.TryParse(deviceSessionIdValue, out var deviceSessionId))
                            {
                                context.Fail("Invalid token session claims.");
                                return;
                            }

                            var db = context.HttpContext.RequestServices
                                .GetRequiredService<AppDbContext>();

                            var now = DateTime.UtcNow;
                            var idleCutoff = jwtSettings.DeviceSessionIdleExpirationDays > 0
                                ? now.AddDays(-jwtSettings.DeviceSessionIdleExpirationDays)
                                : DateTime.MinValue;
                            var absoluteCutoff = jwtSettings.DeviceSessionAbsoluteExpirationDays > 0
                                ? now.AddDays(-jwtSettings.DeviceSessionAbsoluteExpirationDays)
                                : DateTime.MinValue;

                            var sessionIsActive = await db.UserDeviceSessions
                                .AsNoTracking()
                                .AnyAsync(
                                    x => x.Id == deviceSessionId &&
                                         x.UserId == userId &&
                                         x.RevokedAt == null &&
                                         x.LastUsedAt > idleCutoff &&
                                         x.CreatedAt > absoluteCutoff &&
                                         x.User.DeletedAt == null &&
                                         x.User.StatusId == UserStatusIds.Active,
                                    context.HttpContext.RequestAborted);

                            if (!sessionIsActive)
                            {
                                context.Fail("Device session is revoked.");
                            }
                        }
                    };
                });

            services.AddAuthorization();

            return services;
        }
    }
}
