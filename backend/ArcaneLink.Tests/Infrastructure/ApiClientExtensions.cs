using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ArcaneLink.DataBase.DTOs.Login;

namespace ArcaneLink.Tests.Infrastructure;

public static class ApiClientExtensions
{
    public static async Task<string> LoginAsync(
        this HttpClient client,
        string loginOrEmail,
        string password = ArcaneLinkApiFactory.Password)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/login",
            new LoginRequest
            {
                LoginOrEmail = loginOrEmail,
                Password = password,
                DeviceName = "integration-test"
            });
        await EnsureSuccessWithBodyAsync(response);

        var json = await response.Content.ReadFromJsonAsync<JsonObject>();
        var accessToken = json?["accessToken"]?.GetValue<string>();

        Assert.False(string.IsNullOrWhiteSpace(accessToken));
        return accessToken!;
    }

    public static async Task EnsureSuccessWithBodyAsync(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var body = await response.Content.ReadAsStringAsync();
        throw new HttpRequestException(
            $"Response status code does not indicate success: {(int)response.StatusCode} ({response.ReasonPhrase}). Body: {body}",
            null,
            response.StatusCode);
    }

    public static void AuthorizeWith(this HttpClient client, string accessToken)
    {
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);
    }
}
