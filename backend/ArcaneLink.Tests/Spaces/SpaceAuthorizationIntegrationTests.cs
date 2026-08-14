using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Spaces;

public sealed class SpaceAuthorizationIntegrationTests
{
    [Fact]
    public async Task PermissionCatalogs_AreSeparatedByScope()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var serverPermissions = await client.GetFromJsonAsync<List<PermissionResponse>>(
            "/api/permissions/server");
        var spacePermissions = await client.GetFromJsonAsync<List<PermissionResponse>>(
            "/api/permissions/space");

        Assert.Equal(
            new[]
            {
                "manage_invites",
                "manage_members",
                "manage_reports",
                "manage_roles",
                "manage_server",
                "view_audit_log"
            },
            serverPermissions!.Select(permission => permission.Code).Order());
        Assert.Equal(
            new[]
            {
                "connect_voice",
                "manage_space",
                "send_messages",
                "view_space"
            },
            spacePermissions!.Select(permission => permission.Code).Order());

        using var createRoleResponse = await client.PostAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/roles",
            new CreateServerRoleRequest
            {
                Title = "Scoped permissions",
                PermissionCodes = ["manage_server", "view_space"]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createRoleResponse);
        var role = await createRoleResponse.Content
            .ReadFromJsonAsync<ServerRoleResponse>();
        Assert.NotNull(role);
        Assert.Equal(
            ["manage_server"],
            role.Permissions.Select(permission => permission.Code));

        using var invalidOverride = await client.PutAsJsonAsync(
            OverridePath(ArcaneLinkApiFactory.TextSpaceId),
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = ServerGovernanceIds.PermissionManageServer,
                Allow = true
            });
        Assert.Equal(HttpStatusCode.NotFound, invalidOverride.StatusCode);
    }

    [Fact]
    public async Task SendAndManage_AreEnforcedIndependently()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        client.AuthorizeWith(await client.LoginAsync("member"));
        var ownMessage = await CreateMessageAsync(client, "member message");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerMessage = await CreateMessageAsync(client, "owner message");
        var firstDeny = await UpsertMemberOverrideAsync(
            client,
            ArcaneLinkApiFactory.TextSpaceId,
            SpacePermissionIds.SendMessages,
            allow: false,
            deny: true);
        var repeatedDeny = await UpsertMemberOverrideAsync(
            client,
            ArcaneLinkApiFactory.TextSpaceId,
            SpacePermissionIds.SendMessages,
            allow: false,
            deny: true);
        Assert.Equal(firstDeny.Id, repeatedDeny.Id);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var restrictedSpace = Assert.Single(
            (await client.GetFromJsonAsync<List<SpaceResponse>>(SpacesPath()))!);
        Assert.False(restrictedSpace.EffectiveCapabilities.CanSendMessages);
        Assert.False(restrictedSpace.EffectiveCapabilities.CanManageSpace);
        Assert.Empty(restrictedSpace.PermissionOverrides);

        using var readResponse = await client.GetAsync(MessagesPath());
        Assert.Equal(HttpStatusCode.OK, readResponse.StatusCode);
        using var sendResponse = await client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "must be rejected" });
        Assert.Equal(HttpStatusCode.NotFound, sendResponse.StatusCode);
        using var editOwnResponse = await client.PatchAsJsonAsync(
            $"{MessagesPath()}/{ownMessage.Id}",
            new UpdateSpaceMessageRequest { Body = "must stay unchanged" });
        Assert.Equal(HttpStatusCode.NotFound, editOwnResponse.StatusCode);
        using var deleteOwnResponse = await client.DeleteAsync(
            $"{MessagesPath()}/{ownMessage.Id}");
        Assert.Equal(HttpStatusCode.NotFound, deleteOwnResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await UpsertMemberOverrideAsync(
            client,
            ArcaneLinkApiFactory.TextSpaceId,
            SpacePermissionIds.ManageSpace,
            allow: true,
            deny: false);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var managerSpace = Assert.Single(
            (await client.GetFromJsonAsync<List<SpaceResponse>>(SpacesPath()))!);
        Assert.False(managerSpace.EffectiveCapabilities.CanSendMessages);
        Assert.True(managerSpace.EffectiveCapabilities.CanManageSpace);
        Assert.Equal(2, managerSpace.PermissionOverrides.Count);

        using var editOtherResponse = await client.PatchAsJsonAsync(
            $"{MessagesPath()}/{ownerMessage.Id}",
            new UpdateSpaceMessageRequest { Body = "manager must not replace another user's text" });
        Assert.Equal(HttpStatusCode.NotFound, editOtherResponse.StatusCode);
        var messagesAfterDeniedEdit = await client
            .GetFromJsonAsync<List<SpaceMessageResponse>>(MessagesPath());
        var unchangedOwnerMessage = Assert.Single(
            messagesAfterDeniedEdit!,
            message => message.Id == ownerMessage.Id);
        Assert.Equal("owner message", unchangedOwnerMessage.Body);
        using var pinOtherResponse = await client.PostAsync(
            $"{MessagesPath()}/{ownerMessage.Id}/pin",
            null);
        Assert.Equal(HttpStatusCode.OK, pinOtherResponse.StatusCode);
        using var deleteOtherResponse = await client.DeleteAsync(
            $"{MessagesPath()}/{ownerMessage.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteOtherResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(
            2,
            await db.SpacePermissionOverrides.CountAsync(permissionOverride =>
                permissionOverride.SpaceId == ArcaneLinkApiFactory.TextSpaceId &&
                permissionOverride.MemberId == ArcaneLinkApiFactory.MemberMemberId));
    }

    [Fact]
    public async Task ViewDeny_ConcealsMessagesSearchLastMessageAndMentions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await CreateMessageAsync(client, "@member visible mention");

        client.AuthorizeWith(await client.LoginAsync("member"));
        var visibleNotifications = await client
            .GetFromJsonAsync<List<UserNotificationResponse>>("/api/notifications");
        Assert.Contains(
            visibleNotifications!,
            notification => notification.Kind == "mention");

        client.AuthorizeWith(await client.LoginAsync("owner"));
        await UpsertMemberOverrideAsync(
            client,
            ArcaneLinkApiFactory.TextSpaceId,
            SpacePermissionIds.ViewSpace,
            allow: false,
            deny: true);
        await CreateMessageAsync(client, "@member hidden mention");

        client.AuthorizeWith(await client.LoginAsync("member"));
        Assert.Empty(
            (await client.GetFromJsonAsync<List<SpaceResponse>>(SpacesPath()))!);

        using var messagesResponse = await client.GetAsync(MessagesPath());
        Assert.Equal(HttpStatusCode.NotFound, messagesResponse.StatusCode);
        using var explicitSearchResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/messages/search?spaceId={ArcaneLinkApiFactory.TextSpaceId}&query=mention");
        Assert.Equal(HttpStatusCode.NotFound, explicitSearchResponse.StatusCode);
        var broadSearch = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/messages/search?query=mention");
        Assert.Empty(broadSearch!);

        var memberships = await client
            .GetFromJsonAsync<List<ServerMemberResponse>>("/api/servers/me");
        var membership = Assert.Single(memberships!);
        Assert.Null(membership.LastMessage);
        Assert.Null(membership.Server.DefaultTextSpaceId);

        var hiddenNotifications = await client
            .GetFromJsonAsync<List<UserNotificationResponse>>("/api/notifications");
        Assert.DoesNotContain(
            hiddenNotifications!,
            notification => notification.Kind == "mention");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(
            1,
            await db.UserNotifications.CountAsync(notification =>
                notification.UserId == ArcaneLinkApiFactory.MemberUserId &&
                notification.Kind == "mention"));
    }

    [Fact]
    public async Task AncestorViewDeny_RemainsAHardGateOverChildAllow()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var category = await CreateSpaceAsync(
            client,
            "category",
            "restricted category");
        var child = await CreateSpaceAsync(
            client,
            "text_room",
            "restricted child",
            category.Id);
        await UpsertMemberOverrideAsync(
            client,
            category.Id,
            SpacePermissionIds.ViewSpace,
            allow: false,
            deny: true);
        await UpsertMemberOverrideAsync(
            client,
            child.Id,
            SpacePermissionIds.ViewSpace,
            allow: true,
            deny: false);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var visibleSpaces = await client
            .GetFromJsonAsync<List<SpaceResponse>>(SpacesPath());
        Assert.DoesNotContain(visibleSpaces!, space => space.Id == category.Id);
        Assert.DoesNotContain(visibleSpaces!, space => space.Id == child.Id);

        using var childMessagesResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{child.Id}/messages");
        Assert.Equal(HttpStatusCode.NotFound, childMessagesResponse.StatusCode);
    }

    private static async Task<SpaceMessageResponse> CreateMessageAsync(
        HttpClient client,
        string body)
    {
        using var response = await client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = body });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var message = await response.Content
            .ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.NotNull(message);
        return message;
    }

    private static async Task<SpaceResponse> CreateSpaceAsync(
        HttpClient client,
        string typeCode,
        string title,
        Guid? parentSpaceId = null)
    {
        using var response = await client.PostAsJsonAsync(
            SpacesPath(),
            new CreateSpaceRequest
            {
                TypeCode = typeCode,
                ParentSpaceId = parentSpaceId,
                Title = title
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var space = await response.Content.ReadFromJsonAsync<SpaceResponse>();
        Assert.NotNull(space);
        return space;
    }

    private static async Task<SpacePermissionOverrideResponse> UpsertMemberOverrideAsync(
        HttpClient client,
        Guid spaceId,
        Guid permissionId,
        bool allow,
        bool deny)
    {
        using var response = await client.PutAsJsonAsync(
            OverridePath(spaceId),
            new UpsertSpacePermissionOverrideRequest
            {
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                PermissionId = permissionId,
                Allow = allow,
                Deny = deny
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        var permissionOverride = await response.Content
            .ReadFromJsonAsync<SpacePermissionOverrideResponse>();
        Assert.NotNull(permissionOverride);
        return permissionOverride;
    }

    private static string SpacesPath()
    {
        return $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces";
    }

    private static string MessagesPath()
    {
        return $"{SpacesPath()}/{ArcaneLinkApiFactory.TextSpaceId}/messages";
    }

    private static string OverridePath(Guid spaceId)
    {
        return $"{SpacesPath()}/{spaceId}/permission-overrides";
    }
}
