using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Spaces;
using ArcaneLink.Services.Messages;
using ArcaneLink.Services.PrivateSpaces;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.PrivateSpaces;

public sealed class PrivateSpaceIntegrationTests
{
    [Fact]
    public async Task Trash_SupportsPersonalAndGlobalRestore_AndPurgesExpiredGlobalMessages()
    {
        var clock = new ManualTimeProvider(
            new DateTimeOffset(2035, 1, 1, 12, 0, 0, TimeSpan.Zero));
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(clock);
        });
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(space.SpaceId)}/messages";

        var personalMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "personal visibility message");

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var deleteForMe = await client.DeleteAsync(
                   $"{messagesPath}/{personalMessage.Id}?scope=me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleteForMe.StatusCode);
        }

        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath))!,
            message => message.Id == personalMessage.Id);
        var memberSpace = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            SpacePath(space.SpaceId));
        Assert.Null(memberSpace!.LastMessage);
        Assert.Equal(0, memberSpace.UnreadCount);
        var memberTrash = await client.GetFromJsonAsync<List<PrivateSpaceTrashMessageResponse>>(
            $"{messagesPath}/trash");
        var personalTrashItem = Assert.Single(memberTrash!);
        Assert.Equal("me", personalTrashItem.Scope);
        Assert.Equal("personal visibility message", personalTrashItem.Message.Body);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        Assert.Contains(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath))!,
            message => message.Id == personalMessage.Id);
        Assert.Empty((await client.GetFromJsonAsync<List<PrivateSpaceTrashMessageResponse>>(
            $"{messagesPath}/trash"))!);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var restoreForMe = await client.PostAsync(
                   $"{messagesPath}/{personalMessage.Id}/restore",
                   null))
        {
            Assert.Equal(HttpStatusCode.NoContent, restoreForMe.StatusCode);
        }
        Assert.Contains(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath))!,
            message => message.Id == personalMessage.Id);

        var ownHiddenMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "own hidden mutation guard");
        using (var hideOwnMessage = await client.DeleteAsync(
                   $"{messagesPath}/{ownHiddenMessage.Id}?scope=me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, hideOwnMessage.StatusCode);
        }
        using (var hiddenUpdate = await client.PatchAsJsonAsync(
                   $"{messagesPath}/{ownHiddenMessage.Id}",
                   new UpdateSpaceMessageRequest { Body = "must restore first" }))
        {
            Assert.Equal(HttpStatusCode.NotFound, hiddenUpdate.StatusCode);
        }
        using (var hiddenPin = await client.PostAsync(
                   $"{messagesPath}/{ownHiddenMessage.Id}/pin",
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, hiddenPin.StatusCode);
        }
        using (var restoreOwnMessage = await client.PostAsync(
                   $"{messagesPath}/{ownHiddenMessage.Id}/restore",
                   null))
        {
            Assert.Equal(HttpStatusCode.NoContent, restoreOwnMessage.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var permanentlyHiddenMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "personal deletion remains hidden after trash expiry");
        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var deletePermanentlyForMe = await client.DeleteAsync(
                   $"{messagesPath}/{permanentlyHiddenMessage.Id}?scope=me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, deletePermanentlyForMe.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var globalMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "globally restorable message");
        var reply = await CreateReplyAsync(
            client,
            messagesPath,
            globalMessage.Id,
            "reply survives target purge");
        using (var deleteForEveryone = await client.DeleteAsync(
                   $"{messagesPath}/{globalMessage.Id}?scope=everyone"))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleteForEveryone.StatusCode);
        }

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stored = await db.SpaceMessages
                .AsNoTracking()
                .SingleAsync(message => message.Id == globalMessage.Id);
            Assert.Equal("globally restorable message", stored.Body);
        }

        var ownerTrash = await client.GetFromJsonAsync<List<PrivateSpaceTrashMessageResponse>>(
            $"{messagesPath}/trash");
        var globalTrashItem = Assert.Single(
            ownerTrash!,
            item => item.Message.Id == globalMessage.Id);
        Assert.Equal("everyone", globalTrashItem.Scope);
        Assert.Equal("globally restorable message", globalTrashItem.Message.Body);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var forbiddenRestore = await client.PostAsync(
                   $"{messagesPath}/{globalMessage.Id}/restore",
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, forbiddenRestore.StatusCode);
        }
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath))!,
            message => message.Id == globalMessage.Id);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using (var restoreForEveryone = await client.PostAsync(
                   $"{messagesPath}/{globalMessage.Id}/restore",
                   null))
        {
            Assert.Equal(HttpStatusCode.NoContent, restoreForEveryone.StatusCode);
        }
        Assert.Contains(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath))!,
            message => message.Id == globalMessage.Id);

        var cursorTimestamp = clock.GetUtcNow().UtcDateTime.AddHours(-1);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(message =>
                    message.Id == globalMessage.Id ||
                    message.Id == reply.Id)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(message => message.CreatedAt, cursorTimestamp)
                    .SetProperty(message => message.UpdatedAt, cursorTimestamp));
            db.SpaceReadStates.Add(new DataBase.Models.MessagesModels.SpaceReadState
            {
                UserId = ArcaneLinkApiFactory.MemberUserId,
                SpaceId = space.SpaceId,
                LastReadMessageId = globalMessage.Id,
                LastReadMessageCreatedAt = cursorTimestamp,
                ReadAt = cursorTimestamp,
                UpdatedAt = cursorTimestamp
            });
            await db.SaveChangesAsync();
        }

        var serverMessagePath =
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
        var serverMessage = await CreateMessageAsync(
            client,
            serverMessagePath,
            "expired server deletion must not be purged by private cleanup");

        using (var deleteAgain = await client.DeleteAsync(
                   $"{messagesPath}/{globalMessage.Id}?scope=everyone"))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleteAgain.StatusCode);
        }
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(message => message.Id == serverMessage.Id)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(message => message.DeletedAt, clock.GetUtcNow().UtcDateTime)
                    .SetProperty(message => message.DeletedByUserId, ArcaneLinkApiFactory.OwnerUserId));
        }

        clock.Advance(TimeSpan.FromHours(24));
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<PrivateSpaceTrashMessageResponse>>(
                $"{messagesPath}/trash"))!,
            item => item.Message.Id == globalMessage.Id);
        using (var expiredRestore = await client.PostAsync(
                   $"{messagesPath}/{globalMessage.Id}/restore",
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, expiredRestore.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath))!,
            message => message.Id == permanentlyHiddenMessage.Id);
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<PrivateSpaceTrashMessageResponse>>(
                $"{messagesPath}/trash"))!,
            item => item.Message.Id == permanentlyHiddenMessage.Id);

        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var runner = scope.ServiceProvider
                .GetRequiredService<PrivateMessageTrashCleanupRunner>();
            var result = await runner.RunOnceAsync();
            Assert.Equal(1, result.MessagesDeleted);

            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.False(await db.SpaceMessages.AnyAsync(
                message => message.Id == globalMessage.Id));
            Assert.True(await db.SpaceMessages.AnyAsync(
                message => message.Id == serverMessage.Id));
            Assert.Null((await db.SpaceMessages
                .AsNoTracking()
                .SingleAsync(message => message.Id == reply.Id)).ReplyToMessageId);
            var readState = await db.SpaceReadStates
                .AsNoTracking()
                .SingleAsync(state =>
                    state.UserId == ArcaneLinkApiFactory.MemberUserId &&
                    state.SpaceId == space.SpaceId);
            Assert.Equal(globalMessage.Id, readState.LastReadMessageId);

            var unreadCounts = await scope.ServiceProvider
                .GetRequiredService<UnreadCountService>()
                .GetPrivateSpaceUnreadCountsAsync(
                    ArcaneLinkApiFactory.MemberUserId,
                    [space.SpaceId]);
            Assert.Equal(
                reply.Id.CompareTo(globalMessage.Id) > 0 ? 1 : 0,
                unreadCounts.GetValueOrDefault(space.SpaceId));
            Assert.True(await db.SpaceMessageUserDeletions.AnyAsync(deletion =>
                deletion.MessageId == permanentlyHiddenMessage.Id &&
                deletion.UserId == ArcaneLinkApiFactory.MemberUserId));
        }
    }

    [Fact]
    public async Task Trash_ClearEndsRestoreWindowAndPermanentlyPurgesOwnGlobalMessages()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(space.SpaceId)}/messages";
        var personalMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "clear personal tombstone");

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var deleteForMe = await client.DeleteAsync(
                   $"{messagesPath}/{personalMessage.Id}?scope=me"))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleteForMe.StatusCode);
        }
        Assert.Single((await client.GetFromJsonAsync<
            List<PrivateSpaceTrashMessageResponse>>($"{messagesPath}/trash"))!);

        using (var clearPersonalTrash = await client.DeleteAsync(
                   $"{messagesPath}/trash"))
        {
            Assert.Equal(HttpStatusCode.NoContent, clearPersonalTrash.StatusCode);
        }
        Assert.Empty((await client.GetFromJsonAsync<
            List<PrivateSpaceTrashMessageResponse>>($"{messagesPath}/trash"))!);
        Assert.DoesNotContain(
            (await client.GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath))!,
            message => message.Id == personalMessage.Id);
        using (var restoreClearedPersonal = await client.PostAsync(
                   $"{messagesPath}/{personalMessage.Id}/restore",
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, restoreClearedPersonal.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var globalMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "clear global message");
        using (var deleteForEveryone = await client.DeleteAsync(
                   $"{messagesPath}/{globalMessage.Id}?scope=everyone"))
        {
            Assert.Equal(HttpStatusCode.NoContent, deleteForEveryone.StatusCode);
        }

        using (var clearGlobalTrash = await client.DeleteAsync(
                   $"{messagesPath}/trash"))
        {
            Assert.Equal(HttpStatusCode.NoContent, clearGlobalTrash.StatusCode);
        }
        using (var clearAgain = await client.DeleteAsync($"{messagesPath}/trash"))
        {
            Assert.Equal(HttpStatusCode.NoContent, clearAgain.StatusCode);
        }
        Assert.Empty((await client.GetFromJsonAsync<
            List<PrivateSpaceTrashMessageResponse>>($"{messagesPath}/trash"))!);
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.SpaceMessages.AnyAsync(
            message => message.Id == globalMessage.Id));
        Assert.True(await db.SpaceMessageUserDeletions.AnyAsync(deletion =>
            deletion.MessageId == personalMessage.Id &&
            deletion.UserId == ArcaneLinkApiFactory.MemberUserId));
    }

    [Fact]
    public async Task ClearHistory_HidesOldMessagesAcrossAllViewerSurfaces()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(space.SpaceId)}/messages";
        var pinnedOldMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "old history item that was pinned");
        using (var pinResponse = await client.PostAsync(
                   $"{messagesPath}/{pinnedOldMessage.Id}/pin",
                   null))
        {
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(pinResponse);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        var personallyDeletedOldMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "old history item in personal trash");
        using (var deleteForMeResponse = await client.DeleteAsync(
                   $"{messagesPath}/{personallyDeletedOldMessage.Id}?scope=me"))
        {
            Assert.Equal(
                HttpStatusCode.NoContent,
                deleteForMeResponse.StatusCode);
        }

        using (var clearHistoryResponse = await client.PostAsync(
                   $"{SpacePath(space.SpaceId)}/history/clear",
                   null))
        {
            Assert.Equal(
                HttpStatusCode.NoContent,
                clearHistoryResponse.StatusCode);
        }

        Assert.Empty((await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            messagesPath))!);
        Assert.Empty((await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{messagesPath}/pinned"))!);
        Assert.Empty((await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{messagesPath}/search?query=old"))!);
        Assert.Empty((await client
            .GetFromJsonAsync<List<PrivateSpaceTrashMessageResponse>>(
                $"{messagesPath}/trash"))!);

        var clearedSpace = await client.GetFromJsonAsync<PrivateSpaceResponse>(
            SpacePath(space.SpaceId));
        Assert.NotNull(clearedSpace);
        Assert.Null(clearedSpace.LastMessage);
        Assert.Equal(0, clearedSpace.UnreadCount);

        using (var restoreOldResponse = await client.PostAsync(
                   $"{messagesPath}/{personallyDeletedOldMessage.Id}/restore",
                   null))
        {
            Assert.Equal(HttpStatusCode.NotFound, restoreOldResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var newMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "new history item");

        client.AuthorizeWith(await client.LoginAsync("member"));
        var visibleMessages = await client
            .GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath);
        var visibleMessage = Assert.Single(visibleMessages!);
        Assert.Equal(newMessage.Id, visibleMessage.Id);
        Assert.DoesNotContain(
            visibleMessages!,
            message => message.Id == pinnedOldMessage.Id);
    }

    [Fact]
    public async Task Trash_CompositeCursorPagesEqualDeletionTimestampsWithoutDuplicates()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(space.SpaceId)}/messages";
        var messageIds = new List<Guid>();

        for (var index = 0; index < 3; index++)
        {
            var message = await CreateMessageAsync(
                client,
                messagesPath,
                $"trash cursor {index}");
            messageIds.Add(message.Id);
            using var deleteResponse = await client.DeleteAsync(
                $"{messagesPath}/{message.Id}?scope=everyone");
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        }

        var sharedDeletedAt = new DateTime(
            2041,
            2,
            3,
            4,
            5,
            6,
            DateTimeKind.Utc);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(message => messageIds.Contains(message.Id))
                .ExecuteUpdateAsync(update => update
                    .SetProperty(message => message.DeletedAt, sharedDeletedAt)
                    .SetProperty(message => message.UpdatedAt, sharedDeletedAt));
        }

        var firstPage = (await client.GetFromJsonAsync<
            List<PrivateSpaceTrashMessageResponse>>(
            $"{messagesPath}/trash?limit=2"))!;
        Assert.Equal(2, firstPage.Count);
        var cursor = firstPage[^1];
        var cursorDeletedAt = Uri.EscapeDataString(cursor.DeletedAt.ToString("O"));
        var nextPage = (await client.GetFromJsonAsync<
            List<PrivateSpaceTrashMessageResponse>>(
            $"{messagesPath}/trash?limit=100&beforeDeletedAt={cursorDeletedAt}&beforeId={cursor.Message.Id}"))!;

        var returnedIds = firstPage
            .Concat(nextPage)
            .Select(item => item.Message.Id)
            .ToList();
        Assert.Equal(3, returnedIds.Count);
        Assert.Equal(3, returnedIds.Distinct().Count());
        Assert.True(messageIds.ToHashSet().SetEquals(returnedIds));

        using var invalidCursor = await client.GetAsync(
            $"{messagesPath}/trash?beforeId={messageIds[0]}");
        Assert.Equal(HttpStatusCode.BadRequest, invalidCursor.StatusCode);
    }

    [Fact]
    public async Task CompositeMessageCursor_DoesNotSkipEqualTimestamps()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(space.SpaceId)}/messages";
        var marker = $"private-cursor-{Guid.NewGuid():N}";
        var messageIds = new List<Guid>();

        for (var index = 0; index < 3; index++)
        {
            using var createResponse = await client.PostAsJsonAsync(
                messagesPath,
                new CreateSpaceMessageRequest { Body = $"{marker}-{index}" });
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
            var created = await createResponse.Content
                .ReadFromJsonAsync<SpaceMessageResponse>();
            Assert.NotNull(created);
            messageIds.Add(created.Id);
        }

        var sharedCreatedAt = new DateTime(
            2040,
            1,
            1,
            12,
            0,
            0,
            DateTimeKind.Utc);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.SpaceMessages
                .Where(message => messageIds.Contains(message.Id))
                .ExecuteUpdateAsync(update => update
                    .SetProperty(message => message.CreatedAt, sharedCreatedAt)
                    .SetProperty(message => message.UpdatedAt, sharedCreatedAt));
        }

        var firstPage = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{messagesPath}?limit=2");
        var firstPageMatches = Assert.IsAssignableFrom<List<SpaceMessageResponse>>(
                firstPage)
            .Where(message => message.Body?.StartsWith(marker) == true)
            .ToList();
        Assert.Equal(2, firstPageMatches.Count);

        var cursor = firstPageMatches[0];
        var cursorCreatedAt = Uri.EscapeDataString(cursor.CreatedAt.ToString("O"));
        var nextPage = await client.GetFromJsonAsync<List<SpaceMessageResponse>>(
            $"{messagesPath}?limit=100&beforeCreatedAt={cursorCreatedAt}&beforeId={cursor.Id}");
        var nextPageIds = Assert.IsAssignableFrom<List<SpaceMessageResponse>>(
                nextPage)
            .Where(message => message.Body?.StartsWith(marker) == true)
            .Select(message => message.Id)
            .ToHashSet();

        Assert.Single(nextPageIds);
        Assert.DoesNotContain(
            firstPageMatches,
            message => nextPageIds.Contains(message.Id));
        Assert.True(messageIds
            .Except(firstPageMatches.Select(message => message.Id))
            .ToHashSet()
            .SetEquals(nextPageIds));
    }

    [Fact]
    public async Task Members_CanEditAndDeleteOnlyOwnMessages()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var messagesPath = $"{SpacePath(space.SpaceId)}/messages";

        client.AuthorizeWith(await client.LoginAsync("member"));
        var createResponse = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = "member private message" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createResponse);
        var created = await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>();
        Assert.NotNull(created);

        var ownEditResponse = await client.PatchAsJsonAsync(
            $"{messagesPath}/{created.Id}",
            new UpdateSpaceMessageRequest { Body = "member edited own message" });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(ownEditResponse);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var creatorEditResponse = await client.PatchAsJsonAsync(
            $"{messagesPath}/{created.Id}",
            new UpdateSpaceMessageRequest { Body = "creator must not replace member text" });
        Assert.Equal(HttpStatusCode.NotFound, creatorEditResponse.StatusCode);

        var messagesAfterDeniedEdit = await client
            .GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath);
        var unchangedMessage = Assert.Single(
            messagesAfterDeniedEdit!,
            message => message.Id == created.Id);
        Assert.Equal("member edited own message", unchangedMessage.Body);

        var creatorDeleteResponse = await client.DeleteAsync(
            $"{messagesPath}/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, creatorDeleteResponse.StatusCode);

        var messagesAfterDeniedDelete = await client
            .GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath);
        var messageAfterDeniedDelete = Assert.Single(
            messagesAfterDeniedDelete!,
            message => message.Id == created.Id);
        Assert.Equal("member edited own message", messageAfterDeniedDelete.Body);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var ownDeleteResponse = await client.DeleteAsync(
            $"{messagesPath}/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, ownDeleteResponse.StatusCode);
    }

    [Fact]
    public async Task FolderList_AlwaysStartsWithImmutableAllFolder()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(client, ArcaneLinkApiFactory.MemberUserId);

        var folders = await client.GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
            "/api/private-space-folders");

        Assert.NotNull(folders);
        var allFolder = Assert.IsType<PrivateSpaceFolderResponse>(folders[0]);
        Assert.Equal(Guid.Empty, allFolder.Id);
        Assert.Equal("Все", allFolder.Name);
        Assert.Equal("message", allFolder.Icon);
        Assert.True(allFolder.IsSystem);
        Assert.Contains(space.SpaceId, allFolder.SpaceIds);

        var deleteResponse = await client.DeleteAsync(
            $"/api/private-space-folders/{Guid.Empty}");
        Assert.Equal(HttpStatusCode.NotFound, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task AllFolder_ReorderPersistsAndDrivesPrivateSpaceListOrder()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var firstSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var secondSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.OutsiderUserId);

        using var reorderResponse = await client.PutAsJsonAsync(
            $"/api/private-space-folders/{Guid.Empty}/spaces/reorder",
            new ReorderPrivateSpaceFolderItemsRequest
            {
                SpaceIds = [firstSpace.SpaceId, secondSpace.SpaceId]
            });

        Assert.Equal(HttpStatusCode.NoContent, reorderResponse.StatusCode);
        var folders = await client.GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
            "/api/private-space-folders");
        var allFolder = Assert.IsType<PrivateSpaceFolderResponse>(folders![0]);
        Assert.Equal(
            [firstSpace.SpaceId, secondSpace.SpaceId],
            allFolder.SpaceIds);

        var spaces = await client.GetFromJsonAsync<List<PrivateSpaceResponse>>(
            "/api/private-spaces");
        Assert.Equal(
            [firstSpace.SpaceId, secondSpace.SpaceId],
            spaces!.Select(space => space.SpaceId));
    }

    [Fact]
    public async Task AllFolder_ReorderRejectsIncompleteListWithoutChangingOrder()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var firstSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var secondSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.OutsiderUserId);
        var expectedOrder = new[] { firstSpace.SpaceId, secondSpace.SpaceId };

        using var initialReorderResponse = await client.PutAsJsonAsync(
            $"/api/private-space-folders/{Guid.Empty}/spaces/reorder",
            new ReorderPrivateSpaceFolderItemsRequest
            {
                SpaceIds = expectedOrder
            });
        Assert.Equal(HttpStatusCode.NoContent, initialReorderResponse.StatusCode);

        using var invalidResponse = await client.PutAsJsonAsync(
            $"/api/private-space-folders/{Guid.Empty}/spaces/reorder",
            new ReorderPrivateSpaceFolderItemsRequest
            {
                SpaceIds = [secondSpace.SpaceId]
            });

        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        var folders = await client.GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
            "/api/private-space-folders");
        Assert.Equal(expectedOrder, folders![0].SpaceIds);
    }

    [Fact]
    public async Task ReopeningHiddenDirectSpace_UnhidesAndLiftsItInAllFolder()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var firstSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var secondSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.OutsiderUserId);

        var foldersAfterCreate = await client
            .GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
                "/api/private-space-folders");
        Assert.Equal(
            [secondSpace.SpaceId, firstSpace.SpaceId],
            foldersAfterCreate![0].SpaceIds);

        var leaveResponse = await client.DeleteAsync(
            $"{SpacePath(firstSpace.SpaceId)}/members/me");
        Assert.Equal(HttpStatusCode.NoContent, leaveResponse.StatusCode);
        var foldersWhileHidden = await client
            .GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
                "/api/private-space-folders");
        Assert.Equal(
            [secondSpace.SpaceId],
            foldersWhileHidden![0].SpaceIds);

        using var reopenResponse = await client.PostAsync(
            $"/api/private-spaces/direct/{ArcaneLinkApiFactory.MemberUserId}",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(reopenResponse);
        var reopenedSpace = await ReadSpaceAsync(reopenResponse);
        Assert.Equal(firstSpace.SpaceId, reopenedSpace.SpaceId);

        var foldersAfterReactivation = await client
            .GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
                "/api/private-space-folders");
        Assert.Equal(
            [firstSpace.SpaceId, secondSpace.SpaceId],
            foldersAfterReactivation![0].SpaceIds);
    }

    [Fact]
    public async Task AllFolderOrderLock_FreezesCurrentOrderUntilItIsDisabled()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var firstSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var secondSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.OutsiderUserId);

        var initialFolders = await client
            .GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
                "/api/private-space-folders");
        Assert.Equal(
            [secondSpace.SpaceId, firstSpace.SpaceId],
            initialFolders![0].SpaceIds);

        using var lockResponse = await client.PutAsJsonAsync(
            $"/api/private-space-folders/{Guid.Empty}/order-lock",
            new SetPrivateSpaceFolderOrderLockRequest { IsLocked = true });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(lockResponse);
        var lockedFolder = (await lockResponse.Content
            .ReadFromJsonAsync<PrivateSpaceFolderResponse>())!;
        Assert.True(lockedFolder.IsOrderLocked);
        Assert.Equal(
            [secondSpace.SpaceId, firstSpace.SpaceId],
            lockedFolder.SpaceIds);

        await CreateMessageAsync(
            client,
            $"{SpacePath(firstSpace.SpaceId)}/messages",
            "activity must not move a locked list item");
        var foldersAfterActivity = await client
            .GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
                "/api/private-space-folders");
        Assert.Equal(
            [secondSpace.SpaceId, firstSpace.SpaceId],
            foldersAfterActivity![0].SpaceIds);

        using var unlockResponse = await client.PutAsJsonAsync(
            $"/api/private-space-folders/{Guid.Empty}/order-lock",
            new SetPrivateSpaceFolderOrderLockRequest { IsLocked = false });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(unlockResponse);
        var unlockedFolder = (await unlockResponse.Content
            .ReadFromJsonAsync<PrivateSpaceFolderResponse>())!;
        Assert.False(unlockedFolder.IsOrderLocked);
        Assert.Equal(
            [firstSpace.SpaceId, secondSpace.SpaceId],
            unlockedFolder.SpaceIds);
    }

    [Fact]
    public async Task CustomFolder_ReorderStillUsesFolderItemPositions()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var firstSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);
        var secondSpace = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.OutsiderUserId);
        using var createFolderResponse = await client.PostAsJsonAsync(
            "/api/private-space-folders",
            new UpsertPrivateSpaceFolderRequest
            {
                Name = "Ordered",
                Icon = "folder",
                SpaceIds = [firstSpace.SpaceId, secondSpace.SpaceId]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(createFolderResponse);
        var folder = await createFolderResponse.Content
            .ReadFromJsonAsync<PrivateSpaceFolderResponse>();
        Assert.NotNull(folder);

        using var reorderResponse = await client.PutAsJsonAsync(
            $"/api/private-space-folders/{folder.Id}/spaces/reorder",
            new ReorderPrivateSpaceFolderItemsRequest
            {
                SpaceIds = [secondSpace.SpaceId, firstSpace.SpaceId]
            });

        Assert.Equal(HttpStatusCode.NoContent, reorderResponse.StatusCode);
        var folders = await client.GetFromJsonAsync<List<PrivateSpaceFolderResponse>>(
            "/api/private-space-folders");
        var reorderedFolder = Assert.Single(
            folders!,
            item => item.Id == folder.Id);
        Assert.Equal(
            [secondSpace.SpaceId, firstSpace.SpaceId],
            reorderedFolder.SpaceIds);
    }

    [Fact]
    public async Task FreeUser_CanCreateSixFoldersButNotSeventh()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        for (var index = 0; index < 6; index++)
        {
            var response = await client.PostAsJsonAsync(
                "/api/private-space-folders",
                new UpsertPrivateSpaceFolderRequest
                {
                    Name = $"Folder {index}",
                    Icon = "⭐"
                });
            await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        }

        var overflowResponse = await client.PostAsJsonAsync(
            "/api/private-space-folders",
            new UpsertPrivateSpaceFolderRequest
            {
                Name = "Folder 7",
                Icon = "⭐"
            });

        Assert.Equal(HttpStatusCode.Conflict, overflowResponse.StatusCode);
    }

    [Fact]
    public async Task FolderName_LongerThanTwelveCharacters_IsRejected()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var response = await client.PostAsJsonAsync(
            "/api/private-space-folders",
            new UpsertPrivateSpaceFolderRequest
            {
                Name = "1234567890123",
                Icon = "folder"
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Owner_CanCreateSpaceThatOnlyActiveMembersCanRead()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId);

        Assert.Equal(ArcaneLinkApiFactory.OwnerUserId, space.CreatedByUserId);
        Assert.Equal(2, space.Members.Count);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var memberResponse = await client.GetAsync(SpacePath(space.SpaceId));
        memberResponse.EnsureSuccessStatusCode();

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var outsiderResponse = await client.GetAsync(SpacePath(space.SpaceId));
        Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);
    }

    [Fact]
    public async Task DeletingDirectSpace_ClearsAndHidesItUntilANewMessageArrives()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));

        var initialResponse = await client.PostAsync(
            $"/api/private-spaces/direct/{ArcaneLinkApiFactory.MemberUserId}",
            null);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(initialResponse);
        var initialSpace = await ReadSpaceAsync(initialResponse);
        var messagesPath = $"{SpacePath(initialSpace.SpaceId)}/messages";
        var oldMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "history hidden for the other participant");

        client.AuthorizeWith(await client.LoginAsync("member"));
        var leaveResponse = await client.DeleteAsync(
            $"{SpacePath(initialSpace.SpaceId)}/members/me");
        Assert.Equal(HttpStatusCode.NoContent, leaveResponse.StatusCode);

        var stillOpenResponse = await client.GetAsync(
            SpacePath(initialSpace.SpaceId));
        stillOpenResponse.EnsureSuccessStatusCode();
        var hiddenSpaces = await client.GetFromJsonAsync<List<PrivateSpaceResponse>>(
            "/api/private-spaces");
        Assert.DoesNotContain(
            hiddenSpaces!,
            space => space.SpaceId == initialSpace.SpaceId);
        var clearedMessages = await client
            .GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath);
        Assert.DoesNotContain(
            clearedMessages!,
            message => message.Id == oldMessage.Id);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var newMessage = await CreateMessageAsync(
            client,
            messagesPath,
            "new message restores the hidden conversation");

        client.AuthorizeWith(await client.LoginAsync("member"));
        var restoredSpaces = await client
            .GetFromJsonAsync<List<PrivateSpaceResponse>>(
                "/api/private-spaces");
        Assert.Contains(
            restoredSpaces!,
            space => space.SpaceId == initialSpace.SpaceId);
        var restoredMessages = await client
            .GetFromJsonAsync<List<SpaceMessageResponse>>(messagesPath);
        Assert.DoesNotContain(
            restoredMessages!,
            message => message.Id == oldMessage.Id);
        Assert.Contains(
            restoredMessages!,
            message => message.Id == newMessage.Id);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var membership = await db.PrivateSpaceMembers
            .AsNoTracking()
            .SingleAsync(member =>
                member.SpaceId == initialSpace.SpaceId &&
                member.UserId == ArcaneLinkApiFactory.MemberUserId);
        Assert.Equal(
            ArcaneLink.DataBase.Constants.PrivateSpaceIds.MemberStatusActive,
            membership.StatusId);
        Assert.NotNull(membership.HistoryClearedAt);
        Assert.Null(membership.HiddenFromListAt);
    }

    [Fact]
    public async Task OnlyGroupOwner_CanRestoreMember()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        var outsiderMember = Assert.Single(
            space.Members,
            member => member.UserId == ArcaneLinkApiFactory.OutsiderUserId);
        using (var removeResponse = await client.DeleteAsync(
                   $"{SpacePath(space.SpaceId)}/members/{outsiderMember.Id}"))
        {
            Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);
        }

        client.AuthorizeWith(await client.LoginAsync("member"));
        var forbiddenResponse = await client.PostAsJsonAsync(
            $"{SpacePath(space.SpaceId)}/members",
            new AddPrivateSpaceMemberRequest
            {
                UserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        Assert.Equal(HttpStatusCode.NotFound, forbiddenResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        var addResponse = await client.PostAsJsonAsync(
            $"{SpacePath(space.SpaceId)}/members",
            new AddPrivateSpaceMemberRequest
            {
                UserId = ArcaneLinkApiFactory.OutsiderUserId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(addResponse);

        var mutation = await addResponse.Content
            .ReadFromJsonAsync<PrivateSpaceMembershipMutationResponse>();
        Assert.NotNull(mutation);
        Assert.False(mutation.CreatedGroup);
        Assert.Equal(space.SpaceId, mutation.SpaceId);
        Assert.Equal(
            ArcaneLinkApiFactory.OutsiderUserId,
            mutation.Member.UserId);
        Assert.Equal("active", mutation.Member.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var outsiderResponse = await client.GetAsync(SpacePath(space.SpaceId));
        outsiderResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Creator_RemovingMemberRevokesSpaceAccess()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var space = await CreatePrivateSpaceAsync(
            client,
            ArcaneLinkApiFactory.MemberUserId,
            ArcaneLinkApiFactory.OutsiderUserId);
        var member = Assert.Single(
            space.Members,
            x => x.UserId == ArcaneLinkApiFactory.MemberUserId);

        var removeResponse = await client.DeleteAsync(
            $"{SpacePath(space.SpaceId)}/members/{member.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var memberResponse = await client.GetAsync(SpacePath(space.SpaceId));
        Assert.Equal(HttpStatusCode.NotFound, memberResponse.StatusCode);
    }

    private static async Task<PrivateSpaceResponse> CreatePrivateSpaceAsync(
        HttpClient client,
        params Guid[] memberUserIds)
    {
        var response = await client.PostAsJsonAsync(
            "/api/private-spaces",
            new CreatePrivateSpaceRequest
            {
                Title = "Integration private space",
                MemberUserIds = memberUserIds
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return await ReadSpaceAsync(response);
    }

    private static async Task<SpaceMessageResponse> CreateMessageAsync(
        HttpClient client,
        string messagesPath,
        string body)
    {
        using var response = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest { Body = body });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static async Task<SpaceMessageResponse> CreateReplyAsync(
        HttpClient client,
        string messagesPath,
        Guid replyToMessageId,
        string body)
    {
        using var response = await client.PostAsJsonAsync(
            messagesPath,
            new CreateSpaceMessageRequest
            {
                Body = body,
                ReplyToMessageId = replyToMessageId
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static async Task<PrivateSpaceResponse> ReadSpaceAsync(
        HttpResponseMessage response)
    {
        var space = await response.Content.ReadFromJsonAsync<PrivateSpaceResponse>();
        Assert.NotNull(space);
        return space;
    }

    private static string SpacePath(Guid spaceId)
    {
        return $"/api/private-spaces/{spaceId}";
    }
}
