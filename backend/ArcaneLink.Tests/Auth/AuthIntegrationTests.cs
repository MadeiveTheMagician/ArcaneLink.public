using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Login;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Auth;

public sealed class AuthIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly HttpClient _client;

    public AuthIntegrationTests(ArcaneLinkApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RegisterLoginAndMe_ReturnsAuthenticatedUser()
    {
        var registerResponse = await _client.PostAsJsonAsync(
            "/api/auth/register",
            new CreateUserRequest
            {
                Login = "newuser",
                DisplayName = "New User",
                Email = "newuser@example.test",
                Password = ArcaneLinkApiFactory.Password
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(registerResponse);

        var loginResponse = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest
            {
                LoginOrEmail = "newuser",
                Password = ArcaneLinkApiFactory.Password,
                DeviceName = "auth-test"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(loginResponse);

        var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonObject>();
        var accessToken = loginJson?["accessToken"]?.GetValue<string>();
        Assert.False(string.IsNullOrWhiteSpace(accessToken));

        _client.AuthorizeWith(accessToken!);
        var me = await _client.GetFromJsonAsync<JsonObject>("/api/users/me");

        Assert.Equal("newuser", me?["login"]?.GetValue<string>());
        Assert.Equal("New User", me?["displayName"]?.GetValue<string>());

        var profileSettings = await _client
            .GetFromJsonAsync<UserProfileSettingsResponse>(
                "/api/users/me/profile/settings");
        Assert.NotNull(profileSettings);
        Assert.Equal(
            PresenceVisibilityCodes.Everyone,
            profileSettings.PresenceVisibility);
        Assert.True(profileSettings.ShowLastSeen);
        Assert.Equal(PresenceModeCodes.Automatic, profileSettings.PresenceMode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_ReturnsUnauthorized()
    {
        var response = await _client.GetAsync("/api/users/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RefreshToken_RotatesTokenAndRejectsReplay()
    {
        var loginResponse = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest
            {
                LoginOrEmail = "member",
                Password = ArcaneLinkApiFactory.Password,
                DeviceName = "refresh-rotation-test"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(loginResponse);

        var loginJson = await loginResponse.Content.ReadFromJsonAsync<JsonObject>();
        var originalRefreshToken = loginJson?["refreshToken"]?.GetValue<string>();
        Assert.False(string.IsNullOrWhiteSpace(originalRefreshToken));

        var refreshResponse = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = originalRefreshToken! });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(refreshResponse);

        var refreshJson = await refreshResponse.Content.ReadFromJsonAsync<JsonObject>();
        var rotatedRefreshToken = refreshJson?["refreshToken"]?.GetValue<string>();

        Assert.False(string.IsNullOrWhiteSpace(rotatedRefreshToken));
        Assert.NotEqual(originalRefreshToken, rotatedRefreshToken);

        var replayResponse = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = originalRefreshToken! });

        Assert.Equal(HttpStatusCode.Unauthorized, replayResponse.StatusCode);
    }

    [Fact]
    public async Task RefreshToken_CanUseHttpOnlyCookieWithoutBodyToken()
    {
        var loginResponse = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest
            {
                LoginOrEmail = "owner",
                Password = ArcaneLinkApiFactory.Password,
                DeviceName = "refresh-cookie-test"
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(loginResponse);

        var refreshCookie = GetRefreshCookie(loginResponse);
        Assert.Contains("HttpOnly", refreshCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("SameSite=Lax", refreshCookie, StringComparison.OrdinalIgnoreCase);
        var assetAccessCookie = GetAssetAccessCookie(loginResponse);
        Assert.Contains("HttpOnly", assetAccessCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("SameSite=Strict", assetAccessCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/assets", assetAccessCookie, StringComparison.OrdinalIgnoreCase);

        using var refreshRequest = new HttpRequestMessage(
            HttpMethod.Post,
            "/api/auth/refresh")
        {
            Content = JsonContent.Create(new { })
        };
        refreshRequest.Headers.Add("Cookie", ExtractRefreshCookieHeader(refreshCookie));

        var refreshResponse = await _client.SendAsync(refreshRequest);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(refreshResponse);

        var refreshJson = await refreshResponse.Content.ReadFromJsonAsync<JsonObject>();
        var accessToken = refreshJson?["accessToken"]?.GetValue<string>();
        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        Assert.Contains(
            "arcanelink.refreshToken=",
            GetRefreshCookie(refreshResponse),
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains(
            "arcanelink.assetAccessToken=",
            GetAssetAccessCookie(refreshResponse),
            StringComparison.OrdinalIgnoreCase);
    }

    private static string GetRefreshCookie(HttpResponseMessage response)
    {
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out var cookies));
        var refreshCookie = cookies.FirstOrDefault(
            x => x.StartsWith("arcanelink.refreshToken=", StringComparison.OrdinalIgnoreCase));

        Assert.False(string.IsNullOrWhiteSpace(refreshCookie));
        return refreshCookie!;
    }

    private static string GetAssetAccessCookie(HttpResponseMessage response)
    {
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out var cookies));
        var assetAccessCookie = cookies.FirstOrDefault(
            x => x.StartsWith(
                "arcanelink.assetAccessToken=",
                StringComparison.OrdinalIgnoreCase));

        Assert.False(string.IsNullOrWhiteSpace(assetAccessCookie));
        return assetAccessCookie!;
    }

    private static string ExtractRefreshCookieHeader(string setCookie)
    {
        var separatorIndex = setCookie.IndexOf(';', StringComparison.Ordinal);

        return separatorIndex >= 0
            ? setCookie[..separatorIndex]
            : setCookie;
    }
}
