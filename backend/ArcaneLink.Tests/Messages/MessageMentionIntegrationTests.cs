using System.Net;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.Services.Messages;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ArcaneLink.Tests.Messages;

public sealed class MessageMentionIntegrationTests : IClassFixture<ArcaneLinkApiFactory>
{
    private readonly ArcaneLinkApiFactory _factory;
    private readonly HttpClient _client;

    public MessageMentionIntegrationTests(ArcaneLinkApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ExplicitUserMention_UsesUtf16Offsets_AndCreatesNotification()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        const string body = "😀 hello @member";
        var start = body.IndexOf("@member", StringComparison.Ordinal);
        using var response = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Body = body,
                Mentions =
                [
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.User,
                        TargetId = ArcaneLinkApiFactory.MemberUserId,
                        Start = start,
                        Length = "@member".Length
                    }
                ]
            });
        response.EnsureSuccessStatusCode();
        var message = (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;

        var mention = Assert.Single(message.Mentions);
        Assert.Equal("@member", mention.DisplayText);
        Assert.Equal(start, mention.Start);
        Assert.Equal(ArcaneLinkApiFactory.MemberUserId, mention.TargetUserId);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.UserNotifications
            .Where(x => x.UserId == ArcaneLinkApiFactory.MemberUserId && x.MessageId == message.Id)
            .ToListAsync());
    }

    [Fact]
    public async Task RoleAndEveryoneMentions_DeduplicateRecipient()
    {
        var roleId = Guid.NewGuid();
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            db.ServerRoles.Add(new ServerRole
            {
                Id = roleId,
                ServerId = ArcaneLinkApiFactory.ServerId,
                Code = $"crew-{roleId:N}",
                Title = $"Crew {roleId:N}"[..20],
                Level = 10,
                Kind = ServerRoleKindCodes.Standard,
                Mentionable = true,
                IsSystem = false,
                CreatedAt = now,
                UpdatedAt = now
            });
            db.ServerMemberRoles.Add(new ServerMemberRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                MemberId = ArcaneLinkApiFactory.MemberMemberId,
                RoleId = roleId,
                AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
                AssignedAt = now
            });
            await db.SaveChangesAsync();
        }

        await using var readScope = _factory.Services.CreateAsyncScope();
        var readDb = readScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var roleTitle = await readDb.ServerRoles
            .Where(x => x.Id == roleId)
            .Select(x => x.Title)
            .SingleAsync();
        var roleToken = $"@{roleTitle}";
        var body = $"{roleToken} @everyone";

        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        using var response = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Body = body,
                Mentions =
                [
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.Role,
                        TargetId = roleId,
                        Start = 0,
                        Length = roleToken.Length
                    },
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.Everyone,
                        Start = roleToken.Length + 1,
                        Length = "@everyone".Length
                    }
                ]
            });
        response.EnsureSuccessStatusCode();
        var message = (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        Assert.Equal(2, message.Mentions.Count);

        Assert.Equal(1, await readDb.UserNotifications.CountAsync(x =>
            x.UserId == ArcaneLinkApiFactory.MemberUserId && x.MessageId == message.Id));
    }

    [Fact]
    public async Task ExplicitRoleMention_RejectsIneligibleRoles_EvenForOwner()
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var blockedRoles = new[]
        {
            new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Title = $"Disabled {suffix}",
                Kind = ServerRoleKindCodes.Standard,
                Mentionable = false,
                IsSystem = false
            },
            new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Title = $"Integration {suffix}",
                Kind = ServerRoleKindCodes.Integration,
                Mentionable = true,
                IsSystem = false
            },
            new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Title = $"System {suffix}",
                Kind = ServerRoleKindCodes.Standard,
                Mentionable = true,
                IsSystem = true
            }
        };
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            foreach (var role in blockedRoles)
            {
                role.CreatedAt = now;
                role.UpdatedAt = now;
            }
            db.ServerRoles.AddRange(blockedRoles);
            await db.SaveChangesAsync();
        }

        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        foreach (var role in blockedRoles)
        {
            var token = $"@{role.Title}";
            using var response = await _client.PostAsJsonAsync(
                MessagesPath(),
                new CreateSpaceMessageRequest
                {
                    Body = token,
                    Mentions =
                    [
                        new SpaceMessageMentionRequest
                        {
                            Kind = MentionKinds.Role,
                            TargetId = role.Id,
                            Start = 0,
                            Length = token.Length
                        }
                    ]
                });

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }
    }

    [Fact]
    public async Task Edit_ReplacesMentions_WithoutDuplicatingNotification()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        using var createResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "draft", Mentions = [] });
        createResponse.EnsureSuccessStatusCode();
        var created = (await createResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        var request = new UpdateSpaceMessageRequest
        {
            Body = "hello @member",
            Mentions =
            [
                new SpaceMessageMentionRequest
                {
                    Kind = MentionKinds.User,
                    TargetId = ArcaneLinkApiFactory.MemberUserId,
                    Start = 6,
                    Length = 7
                }
            ]
        };

        using (var first = await _client.PatchAsJsonAsync($"{MessagesPath()}/{created.Id}", request))
        {
            first.EnsureSuccessStatusCode();
        }
        using (var second = await _client.PatchAsJsonAsync($"{MessagesPath()}/{created.Id}", request))
        {
            second.EnsureSuccessStatusCode();
        }

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.SpaceMessageMentions.CountAsync(x => x.MessageId == created.Id));
        Assert.Equal(1, await db.UserNotifications.CountAsync(x =>
            x.UserId == ArcaneLinkApiFactory.MemberUserId && x.MessageId == created.Id));
    }

    [Fact]
    public async Task ReplyPreview_BecomesUnavailableAfterTargetDeletion()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        var original = await CreateMessageAsync("reply target");

        _client.AuthorizeWith(await _client.LoginAsync("member"));
        using var replyResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Body = "reply body",
                ReplyToMessageId = original.Id,
                Mentions = []
            });
        replyResponse.EnsureSuccessStatusCode();
        var reply = (await replyResponse.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        Assert.Equal("reply target", reply.ReplyTo?.Body);
        Assert.Equal("Owner", reply.ReplyTo?.SenderDisplayName);
        Assert.False(reply.ReplyTo?.IsUnavailable);

        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        using var deleteResponse = await _client.DeleteAsync($"{MessagesPath()}/{original.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        _client.AuthorizeWith(await _client.LoginAsync("member"));
        var messages = await _client.GetFromJsonAsync<List<SpaceMessageResponse>>(MessagesPath());
        var reloaded = Assert.Single(messages!, x => x.Id == reply.Id);
        Assert.True(reloaded.ReplyTo?.IsUnavailable);
        Assert.Null(reloaded.ReplyTo?.Body);
        Assert.Null(reloaded.ReplyTo?.SenderDisplayName);
    }

    [Fact]
    public async Task ExplicitMention_WithNonCanonicalToken_IsRejected()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        using var response = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Body = "hello @Member",
                Mentions =
                [
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.User,
                        TargetId = ArcaneLinkApiFactory.MemberUserId,
                        Start = 6,
                        Length = 7
                    }
                ]
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ExplicitMention_AllowsSentenceDot_ButRejectsLoginContinuation()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        using var sentenceResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Body = "hello @member.",
                Mentions =
                [
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.User,
                        TargetId = ArcaneLinkApiFactory.MemberUserId,
                        Start = 6,
                        Length = 7
                    }
                ]
            });
        sentenceResponse.EnsureSuccessStatusCode();

        using var continuationResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest
            {
                Body = "hello @member.extra",
                Mentions =
                [
                    new SpaceMessageMentionRequest
                    {
                        Kind = MentionKinds.User,
                        TargetId = ArcaneLinkApiFactory.MemberUserId,
                        Start = 6,
                        Length = 7
                    }
                ]
            });

        Assert.Equal(HttpStatusCode.NotFound, continuationResponse.StatusCode);
    }

    [Fact]
    public async Task LegacyMention_AllowsSentenceDot_ButRejectsUnknownDottedContinuation()
    {
        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        using var sentenceResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "legacy @member." });
        sentenceResponse.EnsureSuccessStatusCode();
        var sentence = (await sentenceResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
        var mention = Assert.Single(sentence.Mentions);
        Assert.Equal("@member", mention.DisplayText);
        Assert.Equal(7, mention.Length);

        using var continuationResponse = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = "legacy @member.extra" });
        continuationResponse.EnsureSuccessStatusCode();
        var continuation = (await continuationResponse.Content
            .ReadFromJsonAsync<SpaceMessageResponse>())!;
        Assert.Empty(continuation.Mentions);

        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.UserNotifications
            .Where(x =>
                x.UserId == ArcaneLinkApiFactory.MemberUserId &&
                x.MessageId == sentence.Id)
            .ToListAsync());
        Assert.Empty(await db.UserNotifications
            .Where(x =>
                x.UserId == ArcaneLinkApiFactory.MemberUserId &&
                x.MessageId == continuation.Id)
            .ToListAsync());
    }

    [Fact]
    public async Task LegacyMention_ResolvesExistingLoginWithInternalDot()
    {
        const string login = "legacy.dotted";
        using var registerResponse = await _client.PostAsJsonAsync(
            "/api/auth/register",
            new CreateUserRequest
            {
                Login = login,
                DisplayName = "Legacy Dotted",
                Email = "legacy.dotted@example.test",
                Password = ArcaneLinkApiFactory.Password
            });
        registerResponse.EnsureSuccessStatusCode();
        var user = (await registerResponse.Content.ReadFromJsonAsync<UserResponse>())!;
        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            var registeredUser = await db.Users.SingleAsync(x => x.Id == user.Id);
            registeredUser.StatusId = UserStatusIds.Active;
            registeredUser.EmailConfirmedAt = now;
            db.ServerMembers.Add(new ServerMember
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                UserId = user.Id,
                StatusId = ServerMemberStatusIds.Active,
                JoinedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            });
            await db.SaveChangesAsync();
        }

        _client.AuthorizeWith(await _client.LoginAsync("owner"));
        using var response = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = $"legacy @{login}." });
        response.EnsureSuccessStatusCode();
        var message = (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
        var mention = Assert.Single(message.Mentions);
        Assert.Equal(user.Id, mention.TargetUserId);
        Assert.Equal($"@{login}", mention.DisplayText);
    }

    private async Task<SpaceMessageResponse> CreateMessageAsync(string body)
    {
        using var response = await _client.PostAsJsonAsync(
            MessagesPath(),
            new CreateSpaceMessageRequest { Body = body, Mentions = [] });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static string MessagesPath() =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";
}
