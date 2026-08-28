using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.DataBase.DTOs.Login;
using ArcaneLink.Tests.Infrastructure;

namespace ArcaneLink.Tests.Auth;

public sealed class DeviceSessionIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly HttpClient _client;

    public DeviceSessionIntegrationTests(ArcaneLinkApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Sessions_CanRevokeOneAndAllOthers_WithoutRevokingCurrent()
    {
        var current = await LoginAsync("current-browser");
        var second = await LoginAsync("second-browser");
        var third = await LoginAsync("third-browser");

        Assert.NotNull(current.DeviceSessionId);
        Assert.NotNull(second.DeviceSessionId);
        Assert.NotNull(third.DeviceSessionId);

        _client.AuthorizeWith(current.AccessToken);

        var sessions = await _client.GetFromJsonAsync<UserDeviceSessionResponse[]>(
            "/api/auth/sessions");

        Assert.NotNull(sessions);
        Assert.Equal(3, sessions.Length);
        Assert.Single(sessions, x => x.IsCurrent && x.Id == current.DeviceSessionId);

        var revokeCurrentResponse = await _client.PostAsync(
            $"/api/auth/sessions/{current.DeviceSessionId}/revoke",
            content: null);

        Assert.Equal(HttpStatusCode.BadRequest, revokeCurrentResponse.StatusCode);

        var revokeSecondResponse = await _client.PostAsync(
            $"/api/auth/sessions/{second.DeviceSessionId}/revoke",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, revokeSecondResponse.StatusCode);

        sessions = await _client.GetFromJsonAsync<UserDeviceSessionResponse[]>(
            "/api/auth/sessions");

        Assert.NotNull(sessions);
        Assert.DoesNotContain(sessions, x => x.Id == second.DeviceSessionId);
        Assert.Contains(sessions, x => x.Id == current.DeviceSessionId && x.IsCurrent);
        Assert.Contains(sessions, x => x.Id == third.DeviceSessionId);

        _client.AuthorizeWith(second.AccessToken);
        var revokedAccessResponse = await _client.GetAsync("/api/users/me");
        Assert.Equal(HttpStatusCode.Unauthorized, revokedAccessResponse.StatusCode);
        _client.AuthorizeWith(current.AccessToken);

        var revokedRefreshResponse = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = second.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, revokedRefreshResponse.StatusCode);

        var revokeOthersResponse = await _client.PostAsync(
            "/api/auth/sessions/revoke-others",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, revokeOthersResponse.StatusCode);

        sessions = await _client.GetFromJsonAsync<UserDeviceSessionResponse[]>(
            "/api/auth/sessions");

        var remaining = Assert.Single(sessions!);
        Assert.Equal(current.DeviceSessionId, remaining.Id);
        Assert.True(remaining.IsCurrent);

        var currentRefreshResponse = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = current.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, currentRefreshResponse.StatusCode);

        var thirdRefreshResponse = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = third.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, thirdRefreshResponse.StatusCode);

        _client.AuthorizeWith(third.AccessToken);
        var thirdAccessResponse = await _client.GetAsync("/api/users/me");
        Assert.Equal(HttpStatusCode.Unauthorized, thirdAccessResponse.StatusCode);

        var finalLogin = await LoginAsync("final-browser");
        _client.AuthorizeWith(finalLogin.AccessToken);
        var revokeAllResponse = await _client.PostAsync(
            "/api/auth/sessions/revoke-all",
            content: null);
        Assert.Equal(HttpStatusCode.NoContent, revokeAllResponse.StatusCode);

        var finalAccessResponse = await _client.GetAsync("/api/users/me");
        Assert.Equal(HttpStatusCode.Unauthorized, finalAccessResponse.StatusCode);
        var finalRefreshResponse = await _client.PostAsJsonAsync(
            "/api/auth/refresh",
            new RefreshTokenRequest { RefreshToken = finalLogin.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, finalRefreshResponse.StatusCode);
    }

    private async Task<LoginResponse> LoginAsync(string deviceName)
    {
        var response = await _client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest
            {
                LoginOrEmail = "owner",
                Password = ArcaneLinkApiFactory.Password,
                DeviceName = deviceName
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);

        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        return Assert.IsType<LoginResponse>(login);
    }
}
