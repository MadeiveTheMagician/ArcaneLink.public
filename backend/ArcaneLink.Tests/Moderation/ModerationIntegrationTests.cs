using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Assets;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.DTOs.Moderation;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.Services.Realtime;
using ArcaneLink.Services.Realtime.Abstractions;
using ArcaneLink.Services.Servers.Authorization;
using ArcaneLink.Tests.Infrastructure;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ArcaneLink.Tests.Moderation;

public sealed class ModerationIntegrationTests
{
    private static string MessagesPath =>
        $"/api/servers/{ArcaneLinkApiFactory.ServerId}/spaces/{ArcaneLinkApiFactory.TextSpaceId}/messages";

    [Fact]
    public async Task Report_IsIdempotent_AndReviewerJsonNeverContainsReporterIdentity()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateMessageAsync(client, "owner", "reported body");

        var first = await ReportAsync(client, "member", message.Id, "harassment", "details");
        var duplicate = await ReportAsync(client, "member", message.Id, "harassment", "changed details");

        Assert.Equal(first.ReportId, duplicate.ReportId);
        Assert.Equal("details", duplicate.Details);
        Assert.Equal("received", duplicate.Status);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var mine = await client.GetFromJsonAsync<List<ModerationReportResponse>>(
            "/api/users/me/moderation-reports");
        Assert.Equal(first.ReportId, Assert.Single(mine!).ReportId);

        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var page = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        var moderationCase = Assert.Single(page!.Items);

        using var detailResponse = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{moderationCase.CaseId}");
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(detailResponse);
        var reviewerJson = await detailResponse.Content.ReadAsStringAsync();
        Assert.DoesNotContain("reporterUserId", reviewerJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(
            ArcaneLinkApiFactory.MemberUserId.ToString(),
            reviewerJson,
            StringComparison.OrdinalIgnoreCase);

        // A reported user and a reporter are excluded even if they otherwise
        // have manage_reports (owners inherit it through manage_server).
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var ownerPage = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        Assert.Empty(ownerPage!.Items);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync(
                $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{moderationCase.CaseId}"))
            .StatusCode);

        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.MemberUserId);
        client.AuthorizeWith(await client.LoginAsync("member"));
        var reporterPage = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        Assert.Empty(reporterPage!.Items);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.ModerationCases.CountAsync());
        Assert.Equal(1, await db.ModerationSubmissions.CountAsync());
        Assert.Equal(1, await db.ModerationEvidence.CountAsync());
    }

    [Fact]
    public async Task CaseUpdate_UsesOptimisticTimestamp_AndMapsReporterStatus()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateMessageAsync(client, "owner", "status body");
        await ReportAsync(client, "member", message.Id, "spam");
        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var page = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        var moderationCase = Assert.Single(page!.Items);
        var originalUpdatedAt = moderationCase.UpdatedAt;

        using var updateResponse = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{moderationCase.CaseId}",
            new UpdateModerationCaseRequest
            {
                Status = ModerationCaseStatuses.InReview,
                Note = "triaged",
                ExpectedUpdatedAt = originalUpdatedAt
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(updateResponse);
        var updated = await updateResponse.Content
            .ReadFromJsonAsync<ModerationCaseDetailResponse>();
        Assert.Equal(ModerationCaseStatuses.InReview, updated!.Status);
        Assert.True(updated.UpdatedAt > originalUpdatedAt);
        Assert.Equal("triaged", Assert.Single(updated.Actions).Note);

        using var staleResponse = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{moderationCase.CaseId}",
            new UpdateModerationCaseRequest
            {
                Status = ModerationCaseStatuses.Resolved,
                ExpectedUpdatedAt = originalUpdatedAt
            });
        Assert.Equal(HttpStatusCode.Conflict, staleResponse.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("member"));
        var mine = await client.GetFromJsonAsync<List<ModerationReportResponse>>(
            "/api/users/me/moderation-reports");
        Assert.Equal("under_review", Assert.Single(mine!).Status);
    }

    [Fact]
    public async Task EvidenceAsset_RemainsReadableWhenGenericDeleteRejectsMessageAsset()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        client.AuthorizeWith(await client.LoginAsync("owner"));
        var asset = await UploadAttachmentAsync(client);
        var message = await CreateMessageAsync(
            client,
            "owner",
            "attachment evidence",
            asset.Id);
        await ReportAsync(client, "member", message.Id, "privacy");
        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var deleteResponse = await client.DeleteAsync($"/api/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.Conflict, deleteResponse.StatusCode);
        using var normalContent = await client.GetAsync($"/api/assets/{asset.Id}/content");
        Assert.Equal(HttpStatusCode.OK, normalContent.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var page = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        var moderationCase = Assert.Single(page!.Items);
        var detail = await client.GetFromJsonAsync<ModerationCaseDetailResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{moderationCase.CaseId}");
        var evidenceAsset = Assert.Single(Assert.Single(detail!.Evidence).Assets);

        using var retainedContent = await client.GetAsync(evidenceAsset.ContentUrl);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(retainedContent);
        Assert.Equal("image/png", retainedContent.Content.Headers.ContentType?.MediaType);
        Assert.Equal(
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
            await retainedContent.Content.ReadAsByteArrayAsync());

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persistedAsset = await db.Assets.AsNoTracking()
            .SingleAsync(x => x.Id == asset.Id);
        Assert.Null(persistedAsset.DeletedAt);
        Assert.Null(persistedAsset.PhysicalDeletedAt);
        Assert.True(await db.ModerationEvidenceAssets.AnyAsync(
            x => x.AssetId == asset.Id));
    }

    [Fact]
    public async Task ReportValidation_RejectsUnknownReasonSelfAndNonMember()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateMessageAsync(client, "owner", "validation body");

        client.AuthorizeWith(await client.LoginAsync("member"));
        using var invalidReason = await client.PostAsJsonAsync(
            $"{MessagesPath}/{message.Id}/reports",
            new CreateModerationReportRequest { ReasonCode = "unknown" });
        Assert.Equal(HttpStatusCode.BadRequest, invalidReason.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("owner"));
        using var selfReport = await client.PostAsJsonAsync(
            $"{MessagesPath}/{message.Id}/reports",
            new CreateModerationReportRequest { ReasonCode = ModerationReasonCodes.Spam });
        Assert.Equal(HttpStatusCode.NotFound, selfReport.StatusCode);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        using var outsiderReport = await client.PostAsJsonAsync(
            $"{MessagesPath}/{message.Id}/reports",
            new CreateModerationReportRequest { ReasonCode = ModerationReasonCodes.Spam });
        Assert.Equal(HttpStatusCode.NotFound, outsiderReport.StatusCode);
    }

    [Fact]
    public async Task ReviewerDeniedSpaceView_CannotListViewOrMutateCase()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateMessageAsync(client, "owner", "hidden moderation case");
        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);
        await DenySpaceViewAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);
        await ReportAsync(client, "member", message.Id, ModerationReasonCodes.Harassment);

        Guid caseId;
        DateTime updatedAt;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var moderationCase = await db.ModerationCases.AsNoTracking().SingleAsync();
            caseId = moderationCase.Id;
            updatedAt = moderationCase.UpdatedAt;
        }

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var page = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        Assert.Empty(page!.Items);

        using var detail = await client.GetAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{caseId}");
        Assert.Equal(HttpStatusCode.NotFound, detail.StatusCode);

        using var update = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{caseId}",
            new UpdateModerationCaseRequest
            {
                Status = ModerationCaseStatuses.InReview,
                ExpectedUpdatedAt = updatedAt
            });
        Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
    }

    [Fact]
    public async Task ExactHistoryPermission_ProtectsReportCreationReviewAndRealtime()
    {
        var realtime = new RecordingModerationRealtime();
        using var factory = new ArcaneLinkApiFactory(services =>
        {
            services.RemoveAll<IRealtimeNotificationService>();
            services.AddSingleton<IRealtimeNotificationService>(realtime);
        });
        using var client = factory.CreateClient();
        var existingMessage = await CreateMessageAsync(
            client,
            "owner",
            "history protected case");
        await ReportAsync(
            client,
            "member",
            existingMessage.Id,
            ModerationReasonCodes.Spam);
        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);
        await SetEveryonePermissionsAsync(factory, ["VIEW_TEXT_SPACES"]);

        client.AuthorizeWith(await client.LoginAsync("member"));
        using (var deniedReport = await client.PostAsJsonAsync(
                   $"{MessagesPath}/{existingMessage.Id}/reports",
                   new CreateModerationReportRequest
                   {
                       ReasonCode = ModerationReasonCodes.Other
                   }))
        {
            Assert.Equal(HttpStatusCode.NotFound, deniedReport.StatusCode);
        }

        Guid caseId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            caseId = await db.ModerationCases
                .Select(moderationCase => moderationCase.Id)
                .SingleAsync();
        }

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var page = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        Assert.Empty(page!.Items);
        using (var detail = await client.GetAsync(
                   $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{caseId}"))
        {
            Assert.Equal(HttpStatusCode.NotFound, detail.StatusCode);
        }

        await GrantGranularPermissionsAsync(
            factory,
            ArcaneLinkApiFactory.MemberMemberId,
            ["READ_MESSAGE_HISTORY"]);
        var secondMessage = await CreateMessageAsync(
            client,
            "owner",
            "reviewer cannot read this case");
        realtime.Clear();
        await ReportAsync(
            client,
            "member",
            secondMessage.Id,
            ModerationReasonCodes.Harassment);

        Assert.DoesNotContain(realtime.Calls, call =>
            call.EventName == RealtimeEventNames.ModerationCaseChanged &&
            call.UserIds.Contains(ArcaneLinkApiFactory.OutsiderUserId));
        Assert.DoesNotContain(realtime.Calls, call => call.ServerId != null);
    }

    [Fact]
    public async Task CaseCursor_DoesNotSkipCasesWithEqualUpdatedAt()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        for (var index = 0; index < 3; index++)
        {
            var message = await CreateMessageAsync(client, "owner", $"cursor body {index}");
            await ReportAsync(client, "member", message.Id, ModerationReasonCodes.Spam);
        }

        var sharedUpdatedAt = new DateTime(2026, 7, 21, 12, 0, 0, DateTimeKind.Utc);
        List<Guid> expectedOrder;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var cases = await db.ModerationCases.ToListAsync();
            foreach (var moderationCase in cases)
            {
                moderationCase.UpdatedAt = sharedUpdatedAt;
            }

            await db.SaveChangesAsync();
            expectedOrder = cases.Select(x => x.Id)
                .OrderByDescending(x => x)
                .ToList();
        }

        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);
        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var firstPage = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases?limit=2");
        Assert.Equal(expectedOrder.Take(2), firstPage!.Items.Select(x => x.CaseId));
        Assert.NotNull(firstPage.NextCursor);

        var cursorTime = Uri.EscapeDataString(
            firstPage.NextCursor!.UpdatedAt.ToString("O"));
        var secondPage = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases?limit=2&beforeUpdatedAt={cursorTime}&beforeId={firstPage.NextCursor.Id}");
        Assert.Equal(expectedOrder.Skip(2), secondPage!.Items.Select(x => x.CaseId));
        Assert.Null(secondPage.NextCursor);
    }

    [Fact]
    public async Task NewReporter_ReopensClosedCase_WhileDuplicateStaysIdempotent()
    {
        using var factory = new ArcaneLinkApiFactory();
        using var client = factory.CreateClient();
        var message = await CreateMessageAsync(client, "owner", "reopen body");
        var originalReport = await ReportAsync(
            client,
            "member",
            message.Id,
            ModerationReasonCodes.Scam);
        await GrantManageReportsAsync(factory, ArcaneLinkApiFactory.OutsiderUserId);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var page = await client.GetFromJsonAsync<ModerationCasePageResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases");
        var moderationCase = Assert.Single(page!.Items);
        using var closeResponse = await client.PatchAsJsonAsync(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{moderationCase.CaseId}",
            new UpdateModerationCaseRequest
            {
                Status = ModerationCaseStatuses.Resolved,
                ExpectedUpdatedAt = moderationCase.UpdatedAt
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(closeResponse);

        var secondReporterId = await RegisterAndJoinAsync(factory, client);
        var secondReport = await ReportAsync(
            client,
            "secondreporter",
            message.Id,
            ModerationReasonCodes.Other);
        Assert.NotEqual(originalReport.ReportId, secondReport.ReportId);
        Assert.Equal("received", secondReport.Status);

        client.AuthorizeWith(await client.LoginAsync("outsider"));
        var reopened = await client.GetFromJsonAsync<ModerationCaseDetailResponse>(
            $"/api/servers/{ArcaneLinkApiFactory.ServerId}/moderation/cases/{moderationCase.CaseId}");
        Assert.Equal(ModerationCaseStatuses.Open, reopened!.Status);
        Assert.Contains(reopened.Actions, action =>
            action.FromStatus == ModerationCaseStatuses.Resolved &&
            action.ToStatus == ModerationCaseStatuses.Open);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await db.ModerationSubmissions.CountAsync());
        Assert.True(await db.ModerationSubmissions.AnyAsync(x =>
            x.ReporterUserId == secondReporterId));
    }

    [Fact]
    public async Task Realtime_IsUserTargeted_AndFailureNeverRollsBackCommittedReport()
    {
        var recorder = new RecordingModerationRealtime();
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IRealtimeNotificationService>();
                services.AddSingleton<IRealtimeNotificationService>(recorder);
            });
        });
        using var client = factory.CreateClient();
        var message = await CreateMessageAsync(client, "owner", "realtime body");
        await GrantManageReportsAsync(
            factory.Services,
            ArcaneLinkApiFactory.OutsiderUserId);
        recorder.Clear();

        var report = await ReportAsync(
            client,
            "member",
            message.Id,
            ModerationReasonCodes.Spam);

        Assert.Contains(recorder.Calls, call =>
            call.EventName == RealtimeEventNames.MyModerationReportsChanged &&
            call.UserIds.SequenceEqual([ArcaneLinkApiFactory.MemberUserId]));
        Assert.Contains(recorder.Calls, call =>
            call.EventName == RealtimeEventNames.ModerationCaseChanged &&
            call.UserIds.SequenceEqual([ArcaneLinkApiFactory.OutsiderUserId]));
        Assert.DoesNotContain(recorder.Calls, call => call.ServerId != null);

        recorder.ThrowForModerationEvents = true;
        var secondMessage = await CreateMessageAsync(client, "owner", "failure body");
        var committed = await ReportAsync(
            client,
            "member",
            secondMessage.Id,
            ModerationReasonCodes.Other);
        Assert.NotEqual(report.ReportId, committed.ReportId);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await db.ModerationSubmissions.CountAsync());
    }

    [Fact]
    public async Task ReportEndpoint_UsesDedicatedPerUserRateLimit()
    {
        using var baseFactory = new ArcaneLinkApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["RateLimiting:ModerationReports:PermitLimit"] = "1",
                    ["RateLimiting:ModerationReports:WindowSeconds"] = "60"
                });
            });
        });
        using var client = factory.CreateClient();
        var message = await CreateMessageAsync(client, "owner", "rate limited body");
        client.AuthorizeWith(await client.LoginAsync("member"));

        using var first = await client.PostAsJsonAsync(
            $"{MessagesPath}/{message.Id}/reports",
            new CreateModerationReportRequest { ReasonCode = "unknown" });
        Assert.Equal(HttpStatusCode.BadRequest, first.StatusCode);

        using var second = await client.PostAsJsonAsync(
            $"{MessagesPath}/{message.Id}/reports",
            new CreateModerationReportRequest { ReasonCode = "unknown" });
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
    }

    private static async Task<SpaceMessageResponse> CreateMessageAsync(
        HttpClient client,
        string login,
        string body,
        Guid? assetId = null)
    {
        client.AuthorizeWith(await client.LoginAsync(login));
        using var response = await client.PostAsJsonAsync(
            MessagesPath,
            new CreateSpaceMessageRequest
            {
                Body = body,
                Attachments = assetId == null
                    ? []
                    : [new CreateSpaceMessageAttachmentRequest { AssetId = assetId.Value }]
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<SpaceMessageResponse>())!;
    }

    private static async Task<ModerationReportResponse> ReportAsync(
        HttpClient client,
        string login,
        Guid messageId,
        string reasonCode,
        string? details = null)
    {
        client.AuthorizeWith(await client.LoginAsync(login));
        using var response = await client.PostAsJsonAsync(
            $"{MessagesPath}/{messageId}/reports",
            new CreateModerationReportRequest
            {
                ReasonCode = reasonCode,
                Details = details
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<ModerationReportResponse>())!;
    }

    private static async Task<AssetResponse> UploadAttachmentAsync(HttpClient client)
    {
        using var form = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", "evidence.png");

        using var response = await client.PostAsync($"{MessagesPath}/attachments", form);
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(response);
        return (await response.Content.ReadFromJsonAsync<AssetResponse>())!;
    }

    private static async Task GrantManageReportsAsync(
        ArcaneLinkApiFactory factory,
        Guid userId)
    {
        await GrantManageReportsAsync(factory.Services, userId);
    }

    private static async Task GrantManageReportsAsync(
        IServiceProvider services,
        Guid userId)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var member = await db.ServerMembers.FirstOrDefaultAsync(x =>
            x.ServerId == ArcaneLinkApiFactory.ServerId &&
            x.UserId == userId);
        if (member == null)
        {
            member = new ServerMember
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                UserId = userId,
                StatusId = ServerMemberStatusIds.Active,
                JoinedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.ServerMembers.Add(member);
        }

        var role = new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = $"Reports {userId:N}",
            Level = 50,
            IsSystem = false,
            PermissionMask = ServerRolePermissionMaskCodec.Encode(
                ServerPermissionRegistry.CreateMask(["MANAGE_REPORTS"])),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = now,
            UpdatedAt = now
        };
        role.Permissions.Add(new ServerRolePermission
        {
            RoleId = role.Id,
            PermissionId = ServerGovernanceIds.PermissionManageReports,
            IsGranted = true,
            CreatedAt = now
        });
        db.ServerRoles.Add(role);
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = member.Id,
            RoleId = role.Id,
            AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            AssignedAt = now
        });
        member.RolesVersion = Guid.NewGuid();
        var server = await db.Servers.SingleAsync(
            x => x.Id == ArcaneLinkApiFactory.ServerId);
        var authorizationVersion = Guid.NewGuid();
        server.AuthorizationVersion = authorizationVersion;
        server.SpaceAclRevision = authorizationVersion;
        await db.SaveChangesAsync();
    }

    private static async Task SetEveryonePermissionsAsync(
        ArcaneLinkApiFactory factory,
        IReadOnlyCollection<string> permissionCodes)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var everyone = await db.ServerRoles.SingleOrDefaultAsync(role =>
            role.ServerId == ArcaneLinkApiFactory.ServerId &&
            role.Kind == ServerRoleKindCodes.Everyone &&
            role.DeletedAt == null);
        if (everyone == null)
        {
            everyone = new ServerRole
            {
                Id = Guid.NewGuid(),
                ServerId = ArcaneLinkApiFactory.ServerId,
                Code = "everyone",
                Title = "@everyone",
                Kind = ServerRoleKindCodes.Everyone,
                Level = int.MaxValue,
                IsSystem = true,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.ServerRoles.Add(everyone);
        }

        everyone.PermissionMask = ServerRolePermissionMaskCodec.Encode(
            ServerPermissionRegistry.CreateMask(permissionCodes));
        everyone.PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion;
        everyone.Version = Guid.NewGuid();
        everyone.UpdatedAt = now;
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        var authorizationVersion = Guid.NewGuid();
        server.AuthorizationVersion = authorizationVersion;
        server.SpaceAclRevision = authorizationVersion;
        await db.SaveChangesAsync();
    }

    private static async Task GrantGranularPermissionsAsync(
        ArcaneLinkApiFactory factory,
        Guid memberId,
        IReadOnlyCollection<string> permissionCodes)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var role = new ServerRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            Title = $"Granular moderation {Guid.NewGuid():N}",
            Level = 30,
            IsSystem = false,
            PermissionMask = ServerRolePermissionMaskCodec.Encode(
                ServerPermissionRegistry.CreateMask(permissionCodes)),
            PermissionSchemaVersion = ServerPermissionRegistry.SchemaVersion,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.ServerRoles.Add(role);
        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            MemberId = memberId,
            RoleId = role.Id,
            AssignedByUserId = ArcaneLinkApiFactory.OwnerUserId,
            AssignedAt = now
        });
        var member = await db.ServerMembers.SingleAsync(candidate =>
            candidate.Id == memberId);
        member.RolesVersion = Guid.NewGuid();
        var server = await db.Servers.SingleAsync(candidate =>
            candidate.Id == ArcaneLinkApiFactory.ServerId);
        var authorizationVersion = Guid.NewGuid();
        server.AuthorizationVersion = authorizationVersion;
        server.SpaceAclRevision = authorizationVersion;
        await db.SaveChangesAsync();
    }

    private static async Task DenySpaceViewAsync(
        ArcaneLinkApiFactory factory,
        Guid userId)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var memberId = await db.ServerMembers
            .Where(x => x.ServerId == ArcaneLinkApiFactory.ServerId &&
                        x.UserId == userId)
            .Select(x => x.Id)
            .SingleAsync();
        db.SpacePermissionOverrides.Add(new SpacePermissionOverride
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            SpaceId = ArcaneLinkApiFactory.TextSpaceId,
            MemberId = memberId,
            PermissionId = SpacePermissionIds.ViewSpace,
            Allow = false,
            Deny = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    private static async Task<Guid> RegisterAndJoinAsync(
        ArcaneLinkApiFactory factory,
        HttpClient client)
    {
        using var registerResponse = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                login = "secondreporter",
                displayName = "Second Reporter",
                email = "secondreporter@example.test",
                password = ArcaneLinkApiFactory.Password
            });
        await ApiClientExtensions.EnsureSuccessWithBodyAsync(registerResponse);
        var registered = await registerResponse.Content
            .ReadFromJsonAsync<System.Text.Json.Nodes.JsonObject>();
        var userId = registered!["id"]!.GetValue<Guid>();

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTime.UtcNow;
        var registeredUser = await db.Users.SingleAsync(x => x.Id == userId);
        registeredUser.StatusId = UserStatusIds.Active;
        registeredUser.EmailConfirmedAt = now;
        db.ServerMembers.Add(new ServerMember
        {
            Id = Guid.NewGuid(),
            ServerId = ArcaneLinkApiFactory.ServerId,
            UserId = userId,
            StatusId = ServerMemberStatusIds.Active,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();
        return userId;
    }

    private sealed class RecordingModerationRealtime : IRealtimeNotificationService
    {
        private readonly object _sync = new();
        private readonly List<RealtimeCall> _calls = [];

        public bool ThrowForModerationEvents { get; set; }

        public IReadOnlyList<RealtimeCall> Calls
        {
            get
            {
                lock (_sync)
                {
                    return _calls.ToList();
                }
            }
        }

        public Task NotifyUserAsync(
            Guid userId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return RecordAsync([userId], null, eventName);
        }

        public Task NotifyUsersAsync(
            IEnumerable<Guid> userIds,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return RecordAsync(userIds.OrderBy(x => x).ToList(), null, eventName);
        }

        public Task NotifyServerAsync(
            Guid serverId,
            string eventName,
            object? payload = null,
            CancellationToken cancellationToken = default)
        {
            return RecordAsync([], serverId, eventName);
        }

        public void Clear()
        {
            lock (_sync)
            {
                _calls.Clear();
            }
        }

        private Task RecordAsync(
            IReadOnlyList<Guid> userIds,
            Guid? serverId,
            string eventName)
        {
            lock (_sync)
            {
                _calls.Add(new RealtimeCall(userIds, serverId, eventName));
            }

            return ThrowForModerationEvents && eventName is
                RealtimeEventNames.ModerationCaseChanged or
                RealtimeEventNames.MyModerationReportsChanged
                    ? Task.FromException(new InvalidOperationException(
                        "Injected moderation realtime failure."))
                    : Task.CompletedTask;
        }
    }

    private sealed record RealtimeCall(
        IReadOnlyList<Guid> UserIds,
        Guid? ServerId,
        string EventName);
}
