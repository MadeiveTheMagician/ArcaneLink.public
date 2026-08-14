using System.Text;
using System.Security.Cryptography;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.AssetsModels;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.SpacesModels;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

const string mainLogin = "load_main";
const string generatedEmailDomain = "arcanelink.test";
const string generatedServerSlugPrefix = "load-lab";
const int directMessageCount = 50;
var mainPassword = ReadRequiredEnvironmentVariable("ARCANELINK_SEED_MAIN_PASSWORD");
var generatedUserPassword = ReadRequiredEnvironmentVariable("ARCANELINK_SEED_USER_PASSWORD");
var connectionString = ReadRequiredEnvironmentVariable("ConnectionStrings__DefaultConnection");

var options = new DbContextOptionsBuilder<AppDbContext>()
    .UseNpgsql(connectionString)
    .Options;

await using var db = new AppDbContext(options);
await db.Database.MigrateAsync();

var now = DateTime.UtcNow;
var passwordHasher = new PasswordHasher<User>();
var mainUser = await db.Users
    .Include(x => x.Profile)
    .FirstOrDefaultAsync(x => x.Login == mainLogin);
var generatedUsers = await db.Users
    .Include(x => x.Profile)
    .Where(x => x.Login.StartsWith("load_user_"))
    .OrderBy(x => x.Login)
    .ToListAsync();

if (mainUser != null || generatedUsers.Count > 0)
{
    var usersToNormalize = new List<User>();

    if (mainUser != null)
    {
        usersToNormalize.Add(mainUser);
    }

    usersToNormalize.AddRange(generatedUsers);

    foreach (var user in usersToNormalize)
    {
        user.LoginNorm = user.Login.ToUpperInvariant();
        user.EmailNorm = user.Email.ToUpperInvariant();
    }

    await db.SaveChangesAsync();

    generatedUsers = await db.Users
        .Include(x => x.Profile)
        .Where(x => x.Login.StartsWith("load_user_"))
        .OrderBy(x => x.Login)
        .ToListAsync();

    var verificationUser = mainUser != null
        ? await db.Users.FirstOrDefaultAsync(x => x.Login == mainLogin)
        : null;
    if (verificationUser != null)
    {
        var verificationResult = passwordHasher.VerifyHashedPassword(
            verificationUser,
            verificationUser.PasswordHash,
            mainPassword);
        Console.WriteLine(
            $"Main login normalization: {verificationUser.LoginNorm}; password verification: {verificationResult}");
    }
}

var generatedServerCount = await db.Servers
    .CountAsync(x => x.Slug.StartsWith(generatedServerSlugPrefix));
var generatedDirectSpaceCount = mainUser == null
    ? 0
    : await db.PrivateSpaceMembers
        .Where(x => x.UserId == mainUser.Id)
        .Select(x => x.SpaceId)
        .Distinct()
        .CountAsync();

if (mainUser != null &&
    generatedUsers.Count == 100 &&
    generatedServerCount >= 30 &&
    generatedDirectSpaceCount >= 30)
{
    await EnsureDirectMessagesAsync(db, mainUser, generatedUsers.Take(30).ToList(), directMessageCount, now);
    await EnsureExtendedFixtureAsync(db, mainUser, generatedUsers, now);
    Console.WriteLine($"Test data already exists for '{mainLogin}'.");
    await WriteCredentialsFilesAsync(db, mainPassword, generatedUserPassword);
    return;
}

if (mainUser != null && generatedUsers.Count != 100)
{
    throw new InvalidOperationException(
        $"Found existing '{mainLogin}' but only {generatedUsers.Count} generated users. " +
        "Please inspect load_user_* rows before reseeding.");
}

await using var transaction = await db.Database.BeginTransactionAsync();

if (mainUser == null)
{
    mainUser = CreateUser(
        login: mainLogin,
        email: $"{mainLogin}@{generatedEmailDomain}",
        displayName: "Load Test Main",
        password: mainPassword,
        createdAt: now,
        passwordHasher);

    generatedUsers = Enumerable.Range(1, 100)
        .Select(index => CreateUser(
            login: $"load_user_{index:000}",
            email: $"load_user_{index:000}@{generatedEmailDomain}",
            displayName: $"Load User {index:000}",
            password: generatedUserPassword,
            createdAt: now.AddSeconds(index),
            passwordHasher))
        .ToList();

    db.Users.Add(mainUser);
    db.Users.AddRange(generatedUsers);
    await db.SaveChangesAsync();
}

var firstServerId = Guid.Empty;
var firstServerTextSpaceId = Guid.Empty;
var allServers = new List<Server>();
var allServerMembers = new List<ServerMember>();
var allSpaces = new List<Space>();
var allServerMessages = new List<SpaceMessage>();
var serverDefaultTextSpaceIds = new Dictionary<Guid, Guid>();

for (var index = 1; index <= 30; index++)
{
    var serverCreatedAt = now.AddMinutes(index);
    var server = new Server
    {
        Id = Guid.NewGuid(),
        CreatedByUserId = mainUser.Id,
        OwnerUserId = mainUser.Id,
        Slug = $"{generatedServerSlugPrefix}-{index:00}",
        Title = $"Load Lab {index:00}",
        Description = index == 1
            ? "Shared load-test server with 100 generated members."
            : "Personal load-test server owned by the main test user.",
        AccessMode = index == 1
            ? ServerAccessModeCodes.Public
            : ServerAccessModeCodes.Private,
        IsSystem = false,
        CreatedAt = serverCreatedAt,
        UpdatedAt = serverCreatedAt
    };

    var textSpace = new Space
    {
        Id = Guid.NewGuid(),
        ServerId = server.Id,
        TypeId = SpaceIds.TypeTextRoom,
        CreatedByUserId = mainUser.Id,
        Title = "general",
        Description = "Seeded text channel",
        Position = 0,
        IsSystem = true,
        CreatedAt = serverCreatedAt,
        UpdatedAt = serverCreatedAt
    };

    var voiceSpace = new Space
    {
        Id = Guid.NewGuid(),
        ServerId = server.Id,
        TypeId = SpaceIds.TypeVoiceRoom,
        CreatedByUserId = mainUser.Id,
        Title = "voice",
        Description = "Seeded voice channel",
        Position = 1,
        IsSystem = true,
        CreatedAt = serverCreatedAt,
        UpdatedAt = serverCreatedAt
    };

    serverDefaultTextSpaceIds[server.Id] = textSpace.Id;
    allServers.Add(server);
    allSpaces.Add(textSpace);
    allSpaces.Add(voiceSpace);
    allServerMembers.Add(CreateServerMember(server.Id, mainUser.Id, mainUser.Id, serverCreatedAt));

    if (index == 1)
    {
        firstServerId = server.Id;
        firstServerTextSpaceId = textSpace.Id;

        foreach (var user in generatedUsers)
        {
            allServerMembers.Add(CreateServerMember(
                server.Id,
                user.Id,
                mainUser.Id,
                serverCreatedAt.AddSeconds(generatedUsers.IndexOf(user) + 1)));
        }
    }

    for (var messageIndex = 1; messageIndex <= 4; messageIndex++)
    {
        allServerMessages.Add(new SpaceMessage
        {
            Id = Guid.NewGuid(),
            SpaceId = textSpace.Id,
            SenderUserId = mainUser.Id,
            MessageTypeId = SpaceIds.MessageTypeText,
            Body = $"Seeded server message {messageIndex} in {server.Title}.",
            CreatedAt = serverCreatedAt.AddMinutes(messageIndex),
            UpdatedAt = serverCreatedAt.AddMinutes(messageIndex)
        });
    }
}

db.Servers.AddRange(allServers);
db.Spaces.AddRange(allSpaces);
db.ServerMembers.AddRange(allServerMembers);
db.SpaceMessages.AddRange(allServerMessages);
await db.SaveChangesAsync();

foreach (var server in allServers)
{
    server.DefaultTextSpaceId = serverDefaultTextSpaceIds[server.Id];
}

await db.SaveChangesAsync();

var friendRequests = new List<FriendRequest>();
var userFriends = new List<UserFriend>();
var privateSpaces = new List<PrivateSpace>();
var privateSpaceMembers = new List<PrivateSpaceMember>();
var privateMessages = new List<SpaceMessage>();
var mainFriends = generatedUsers.Take(30).ToList();

for (var index = 0; index < mainFriends.Count; index++)
{
    var friend = mainFriends[index];
    var requestCreatedAt = now.AddHours(1).AddMinutes(index);
    var request = new FriendRequest
    {
        Id = Guid.NewGuid(),
        FromUserId = friend.Id,
        ToUserId = mainUser.Id,
        StatusId = FriendRequestStatusIds.Accepted,
        CreatedAt = requestCreatedAt,
        UpdatedAt = requestCreatedAt.AddMinutes(1),
        RespondedAt = requestCreatedAt.AddMinutes(1)
    };

    friendRequests.Add(request);
    userFriends.Add(new UserFriend
    {
        UserId = mainUser.Id,
        FriendUserId = friend.Id,
        CreatedByRequestId = request.Id,
        CreatedAt = request.RespondedAt.Value
    });
    userFriends.Add(new UserFriend
    {
        UserId = friend.Id,
        FriendUserId = mainUser.Id,
        CreatedByRequestId = request.Id,
        CreatedAt = request.RespondedAt.Value
    });

    var spaceCreatedAt = now.AddHours(2).AddMinutes(index);
    var space = new Space
    {
        Id = Guid.NewGuid(),
        TypeId = SpaceIds.TypeTextRoom,
        CreatedByUserId = mainUser.Id,
        Title = friend.Profile.DisplayName,
        Position = 0,
        IsSystem = false,
        CreatedAt = spaceCreatedAt,
        UpdatedAt = spaceCreatedAt.AddMinutes(8)
    };

    privateSpaces.Add(new PrivateSpace
    {
        SpaceId = space.Id,
        Space = space,
        CreatedByUserId = mainUser.Id,
        CreatedAt = spaceCreatedAt,
        UpdatedAt = space.UpdatedAt
    });
    privateSpaceMembers.Add(CreatePrivateSpaceMember(space.Id, mainUser.Id, null, spaceCreatedAt));
    privateSpaceMembers.Add(CreatePrivateSpaceMember(space.Id, friend.Id, mainUser.Id, spaceCreatedAt.AddSeconds(30)));

    var directBodies = BuildDirectMessageBodies(friend.Profile.DisplayName, directMessageCount);

    for (var messageIndex = 0; messageIndex < directBodies.Count; messageIndex++)
    {
        privateMessages.Add(new SpaceMessage
        {
            Id = Guid.NewGuid(),
            SpaceId = space.Id,
            SenderUserId = messageIndex % 2 == 0 ? mainUser.Id : friend.Id,
            MessageTypeId = SpaceIds.MessageTypeText,
            Body = directBodies[messageIndex],
            CreatedAt = spaceCreatedAt.AddMinutes(messageIndex + 1),
            UpdatedAt = spaceCreatedAt.AddMinutes(messageIndex + 1)
        });
    }
}

db.FriendRequests.AddRange(friendRequests);
db.UserFriends.AddRange(userFriends);
db.PrivateSpaces.AddRange(privateSpaces);
db.PrivateSpaceMembers.AddRange(privateSpaceMembers);
db.SpaceMessages.AddRange(privateMessages);
await db.SaveChangesAsync();
await transaction.CommitAsync();

await EnsureExtendedFixtureAsync(db, mainUser, generatedUsers, now);
await WriteCredentialsFilesAsync(db, mainPassword, generatedUserPassword);

Console.WriteLine("Seeded ArcaneLink test data.");
Console.WriteLine($"Main user: {mainLogin} / {mainPassword}");
Console.WriteLine($"Generated users: 100 users, password {generatedUserPassword}");
Console.WriteLine($"Servers: 30 owned by main user; server '{generatedServerSlugPrefix}-01' has 100 generated members.");
Console.WriteLine($"Private direct dialogs: {mainFriends.Count} with seeded messages.");
Console.WriteLine($"First server id: {firstServerId}");
Console.WriteLine($"First server text space id: {firstServerTextSpaceId}");

static User CreateUser(
    string login,
    string email,
    string displayName,
    string password,
    DateTime createdAt,
    PasswordHasher<User> passwordHasher)
{
    var user = new User
    {
        Id = Guid.NewGuid(),
        Login = login,
        LoginNorm = login.ToUpperInvariant(),
        Email = email,
        EmailNorm = email.ToUpperInvariant(),
        PasswordHash = string.Empty,
        StatusId = UserStatusIds.Active,
        SubscriptionTypeId = SubscriptionTypeIds.Free,
        CreatedAt = createdAt,
        UpdatedAt = createdAt,
        PasswordChangedAt = createdAt,
        LastSeenAt = createdAt,
        Profile = new UserProfile
        {
            DisplayName = displayName,
            DisplayNameNorm = displayName.ToLowerInvariant(),
            Bio = "Generated ArcaneLink test account.",
            UpdatedAt = createdAt
        },
        ProfileSettings = new UserProfileSettings
        {
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
            UpdatedAt = createdAt
        }
    };

    user.PasswordHash = passwordHasher.HashPassword(user, password);
    return user;
}

static ServerMember CreateServerMember(
    Guid serverId,
    Guid userId,
    Guid addedByUserId,
    DateTime joinedAt)
{
    return new ServerMember
    {
        Id = Guid.NewGuid(),
        ServerId = serverId,
        UserId = userId,
        StatusId = ServerMemberStatusIds.Active,
        JoinedAt = joinedAt,
        AddedByUserId = addedByUserId,
        CreatedAt = joinedAt,
        UpdatedAt = joinedAt
    };
}

static PrivateSpaceMember CreatePrivateSpaceMember(
    Guid spaceId,
    Guid userId,
    Guid? addedByUserId,
    DateTime joinedAt)
{
    return new PrivateSpaceMember
    {
        Id = Guid.NewGuid(),
        SpaceId = spaceId,
        UserId = userId,
        StatusId = PrivateSpaceIds.MemberStatusActive,
        ListActivityAt = joinedAt,
        JoinedAt = joinedAt,
        AddedByUserId = addedByUserId,
        CreatedAt = joinedAt,
        UpdatedAt = joinedAt
    };
}

static IReadOnlyList<string> BuildDirectMessageBodies(string friendDisplayName, int count)
{
    var templates = new[]
    {
        "Checking the direct-message list and scroll position.",
        "Reply received. This conversation is ready for UI testing.",
        "Adding a little more history for preview and pagination checks.",
        "This seeded message helps test alternating sender layout.",
        "Another line for message density, spacing, and timestamp checks.",
        "Keeping the conversation active with a realistic short response.",
        "Testing how the panel behaves with a longer direct-message history.",
        "This entry is useful for search, rendering, and unread previews.",
        "Continuing the seeded dialogue for load-test coverage.",
        "Final template cycle entry before the pattern repeats."
    };

    return Enumerable.Range(1, count)
        .Select(index =>
        {
            var template = templates[(index - 1) % templates.Length];
            return $"DM seed {index:00} with {friendDisplayName}: {template}";
        })
        .ToList();
}

static async Task EnsureDirectMessagesAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> friends,
    int targetMessageCount,
    DateTime now)
{
    var totalAdded = 0;

    foreach (var friend in friends)
    {
        var privateSpace = await db.PrivateSpaces
            .Include(x => x.Space)
            .Include(x => x.Members)
            .FirstOrDefaultAsync(x =>
                x.DeletedAt == null &&
                x.Members.Count == 2 &&
                x.Members.Any(member => member.UserId == mainUser.Id) &&
                x.Members.Any(member => member.UserId == friend.Id));

        if (privateSpace == null)
        {
            continue;
        }

        var existingMessageCount = await db.SpaceMessages
            .CountAsync(x => x.SpaceId == privateSpace.SpaceId && x.DeletedAt == null);

        if (existingMessageCount >= targetMessageCount)
        {
            continue;
        }

        var lastCreatedAt = await db.SpaceMessages
            .Where(x => x.SpaceId == privateSpace.SpaceId)
            .MaxAsync(x => (DateTime?)x.CreatedAt) ?? now;
        var bodies = BuildDirectMessageBodies(friend.Profile.DisplayName, targetMessageCount);

        for (var index = existingMessageCount; index < targetMessageCount; index++)
        {
            var createdAt = lastCreatedAt.AddMinutes(index - existingMessageCount + 1);
            db.SpaceMessages.Add(new SpaceMessage
            {
                Id = Guid.NewGuid(),
                SpaceId = privateSpace.SpaceId,
                SenderUserId = index % 2 == 0 ? mainUser.Id : friend.Id,
                MessageTypeId = SpaceIds.MessageTypeText,
                Body = bodies[index],
                CreatedAt = createdAt,
                UpdatedAt = createdAt
            });
            totalAdded++;
        }

        privateSpace.UpdatedAt = lastCreatedAt.AddMinutes(targetMessageCount - existingMessageCount);
        privateSpace.Space.UpdatedAt = privateSpace.UpdatedAt;
    }

    if (totalAdded > 0)
    {
        await db.SaveChangesAsync();
        Console.WriteLine($"Added {totalAdded} direct messages to reach {targetMessageCount} per seeded dialog.");
    }
}

static async Task EnsureExtendedFixtureAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> generatedUsers,
    DateTime now)
{
    var servers = await db.Servers
        .Where(x => x.Slug.StartsWith("load-lab"))
        .OrderBy(x => x.Slug)
        .ToListAsync();

    if (servers.Count == 0)
    {
        return;
    }

    var bigServer = servers[0];

    await EnsureProfilesAsync(db, generatedUsers, now);
    await EnsureUserStatusesAndSubscriptionsAsync(db, mainUser, generatedUsers, now);
    await EnsureServerSizesAsync(db, mainUser, generatedUsers, servers, now);
    var bigServerTextSpaces = await EnsureServerChannelsAsync(db, mainUser, bigServer, now);
    await EnsureServerMessagesAsync(db, mainUser, generatedUsers, bigServer, bigServerTextSpaces, now);
    await EnsureRolesInvitesAndAuditAsync(db, mainUser, generatedUsers, bigServer, bigServerTextSpaces, now);
    await EnsureFriendRequestStatesAsync(db, mainUser, generatedUsers, now);
    await EnsureAdditionalPrivateSpacesAsync(db, mainUser, generatedUsers, now);
    await EnsureAttachmentMessagesAsync(db, mainUser, generatedUsers, bigServer, bigServerTextSpaces.First(), now);

    Console.WriteLine("Extended fixture ensured: server sizes, channels, messages, attachments, roles, invites, profiles, friend states, and private spaces.");
    await PrintFixtureSummaryAsync(db, mainUser, bigServer);
}

static async Task EnsureProfilesAsync(
    AppDbContext db,
    IReadOnlyList<User> users,
    DateTime now)
{
    var themes = new[]
    {
        SystemThemeIds.Sapphire,
        SystemThemeIds.Ivory,
        SystemThemeIds.Gray,
        SystemThemeIds.Sky,
        SystemThemeIds.Black,
        SystemThemeIds.Pink,
        SystemThemeIds.GreenApple
    };
    var colors = new[]
    {
        "#8EA2EE",
        "#64D2A6",
        "#F5A524",
        "#F472B6",
        "#38BDF8",
        "#A78BFA",
        "#F87171"
    };

    for (var index = 0; index < users.Count; index++)
    {
        var user = await db.Users
            .Include(x => x.Profile)
            .Include(x => x.ProfileSettings)
            .FirstAsync(x => x.Id == users[index].Id);

        if (index < 12)
        {
            var displayName = index % 4 == 0
                ? $"Тестовый маг {index + 1:00}"
                : $"Load Persona {index + 1:00}";
            user.Profile.DisplayName = displayName;
            user.Profile.DisplayNameNorm = displayName.ToLowerInvariant();
        }

        user.Profile.Bio = $"Generated profile for fixture user {index + 1:000}. SEARCH_PROFILE_{index + 1:000}";
        user.Profile.WebsiteUrl = $"https://arcanelink.test/users/{user.Login}";
        user.Profile.UpdatedAt = now.AddMinutes(index);
        user.ProfileSettings.SelectedThemeId = themes[index % themes.Length];
        user.ProfileSettings.ProfileColor = colors[index % colors.Length];
        user.ProfileSettings.InterfaceScale = index % 5 == 0 ? 1.1 : 1;
        user.ProfileSettings.FontScale = index % 7 == 0 ? 1.08 : 1;
        user.ProfileSettings.ServerInterfaceScale = index % 6 == 0 ? 1.05 : 1;
        user.ProfileSettings.UpdatedAt = now.AddMinutes(index);

        if (index < 20 && user.Profile.AvatarAssetId == null)
        {
            var avatar = await EnsureSeedAssetAsync(
                db,
                user.Id,
                AssetTypeIds.Avatar,
                $"fixture-avatar-{index + 1:00}.svg",
                "image/svg+xml",
                BuildAvatarSvgBytes(index),
                now.AddMinutes(index),
                width: 128,
                height: 128);
            user.Profile.AvatarAssetId = avatar.Id;
            user.Profile.AvatarCropZoom = 1;
        }
    }

    await db.SaveChangesAsync();
}

static async Task EnsureUserStatusesAndSubscriptionsAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> generatedUsers,
    DateTime now)
{
    var main = await db.Users.FirstAsync(x => x.Id == mainUser.Id);
    main.StatusId = UserStatusIds.Active;
    main.DeletedAt = null;
    main.SubscriptionTypeId = SubscriptionTypeIds.Prime;
    main.UpdatedAt = now;

    for (var index = 0; index < generatedUsers.Count; index++)
    {
        var user = await db.Users.FirstAsync(x => x.Id == generatedUsers[index].Id);

        user.StatusId = (index % 10) switch
        {
            7 or 8 => UserStatusIds.Banned,
            9 => UserStatusIds.Deleted,
            _ => UserStatusIds.Active
        };
        user.DeletedAt = user.StatusId == UserStatusIds.Deleted
            ? now.AddDays(-1).AddMinutes(index)
            : null;
        user.SubscriptionTypeId = (index % 6) switch
        {
            0 or 1 or 2 => SubscriptionTypeIds.Free,
            3 or 4 => SubscriptionTypeIds.Plus,
            _ => SubscriptionTypeIds.Prime
        };
        user.UpdatedAt = now.AddMinutes(index);
    }

    await db.SaveChangesAsync();
    Console.WriteLine("User statuses and subscription tiers ensured: main=active/prime, generated users mixed active/banned/deleted and free/plus/prime.");
}

static async Task EnsureServerSizesAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> users,
    IReadOnlyList<Server> servers,
    DateTime now)
{
    for (var index = 0; index < servers.Count; index++)
    {
        var targetUsers = index switch
        {
            0 => users,
            >= 1 and <= 5 => users.Skip(index * 10).Take(20 + index * 4).ToList(),
            _ => users.Skip(index).Take(index % 5 + 1).ToList()
        };

        foreach (var user in targetUsers)
        {
            await EnsureServerMemberAsync(db, servers[index].Id, user.Id, mainUser.Id, now.AddMinutes(index));
        }
    }
}

static async Task<List<Space>> EnsureServerChannelsAsync(
    AppDbContext db,
    User mainUser,
    Server server,
    DateTime now)
{
    var textSpaces = new List<Space>();
    var defaultTextSpace = await db.Spaces
        .FirstOrDefaultAsync(x => x.Id == server.DefaultTextSpaceId);

    if (defaultTextSpace != null)
    {
        textSpaces.Add(defaultTextSpace);
    }

    for (var index = 1; index <= 2; index++)
    {
        await EnsureSpaceAsync(
            db,
            server.Id,
            mainUser.Id,
            $"load-category-{index:00}",
            SpaceIds.TypeCategory,
            index * 100,
            now);
    }

    for (var index = 1; index <= 14; index++)
    {
        var space = await EnsureSpaceAsync(
            db,
            server.Id,
            mainUser.Id,
            $"load-text-{index:00}",
            SpaceIds.TypeTextRoom,
            index,
            now);
        textSpaces.Add(space);
    }

    for (var index = 1; index <= 5; index++)
    {
        await EnsureSpaceAsync(
            db,
            server.Id,
            mainUser.Id,
            $"load-voice-{index:00}",
            SpaceIds.TypeVoiceRoom,
            200 + index,
            now);
    }

    return textSpaces
        .GroupBy(x => x.Id)
        .Select(x => x.First())
        .ToList();
}

static async Task EnsureServerMessagesAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> users,
    Server server,
    IReadOnlyList<Space> textSpaces,
    DateTime now)
{
    for (var spaceIndex = 0; spaceIndex < textSpaces.Count; spaceIndex++)
    {
        var space = textSpaces[spaceIndex];
        var targetCount = spaceIndex switch
        {
            0 => 500,
            1 => 0,
            2 => 1,
            3 => 2,
            _ => 25 + (spaceIndex % 4) * 10
        };

        await EnsureSpaceMessagesAsync(
            db,
            space.Id,
            users.Prepend(mainUser).ToList(),
            targetCount,
            $"Server {server.Title} / {space.Title}",
            now.AddHours(3).AddMinutes(spaceIndex * 10));
    }
}

static async Task EnsureRolesInvitesAndAuditAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> users,
    Server server,
    IReadOnlyList<Space> textSpaces,
    DateTime now)
{
    var adminRole = await EnsureServerRoleAsync(db, server.Id, "fixture-admin", "Admin", 10, now);
    var moderatorRole = await EnsureServerRoleAsync(db, server.Id, "fixture-moderator", "Moderator", 20, now);
    var memberRole = await EnsureServerRoleAsync(db, server.Id, "fixture-member", "Member", 50, now);
    var mutedRole = await EnsureServerRoleAsync(db, server.Id, "fixture-muted", "Muted", 90, now);

    await EnsureRolePermissionAsync(db, adminRole.Id, ServerGovernanceIds.PermissionManageServer, now);
    await EnsureRolePermissionAsync(db, adminRole.Id, ServerGovernanceIds.PermissionManageRoles, now);
    await EnsureRolePermissionAsync(db, adminRole.Id, ServerGovernanceIds.PermissionManageInvites, now);
    await EnsureRolePermissionAsync(db, adminRole.Id, ServerGovernanceIds.PermissionManageMembers, now);
    await EnsureRolePermissionAsync(db, adminRole.Id, ServerGovernanceIds.PermissionViewAuditLog, now);
    await EnsureRolePermissionAsync(db, moderatorRole.Id, ServerGovernanceIds.PermissionManageMembers, now);
    await EnsureRolePermissionAsync(db, moderatorRole.Id, ServerGovernanceIds.PermissionViewAuditLog, now);

    await AssignRoleToUsersAsync(db, server.Id, mainUser.Id, users.Take(3), adminRole.Id, now);
    await AssignRoleToUsersAsync(db, server.Id, mainUser.Id, users.Skip(3).Take(7), moderatorRole.Id, now);
    await AssignRoleToUsersAsync(db, server.Id, mainUser.Id, users.Skip(10).Take(40), memberRole.Id, now);
    await AssignRoleToUsersAsync(db, server.Id, mainUser.Id, users.Skip(50).Take(5), mutedRole.Id, now);

    if (textSpaces.Count > 4)
    {
        var privateModSpace = textSpaces[4];
        await EnsureSpaceOverrideAsync(db, privateModSpace.Id, moderatorRole.Id, ServerGovernanceIds.PermissionManageMembers, allow: true, now);
        await EnsureSpaceOverrideAsync(db, privateModSpace.Id, mutedRole.Id, ServerGovernanceIds.PermissionManageMembers, allow: false, now);
    }

    var activeInvite = await EnsureInviteAsync(db, server.Id, mainUser.Id, "LOAD-ACTIVE-01", null, null, now);
    var expiredInvite = await EnsureInviteAsync(db, server.Id, mainUser.Id, "LOAD-EXPIRED-01", null, now.AddDays(-1), now.AddDays(-7));
    var limitedInvite = await EnsureInviteAsync(db, server.Id, mainUser.Id, "LOAD-LIMITED-01", 3, now.AddDays(7), now);
    var usedInvite = await EnsureInviteAsync(db, server.Id, mainUser.Id, "LOAD-USED-01", 1, now.AddDays(7), now);
    await EnsureInviteUsageAsync(db, usedInvite, users[80].Id, now.AddMinutes(12));

    await EnsureAuditAsync(db, server.Id, ServerGovernanceIds.AuditInviteCreated, mainUser.Id, relatedInviteId: activeInvite.Id, now: now);
    await EnsureAuditAsync(db, server.Id, ServerGovernanceIds.AuditInviteCreated, mainUser.Id, relatedInviteId: expiredInvite.Id, now: now.AddMinutes(1));
    await EnsureAuditAsync(db, server.Id, ServerGovernanceIds.AuditInviteCreated, mainUser.Id, relatedInviteId: limitedInvite.Id, now: now.AddMinutes(2));
    await EnsureAuditAsync(db, server.Id, ServerGovernanceIds.AuditInviteCreated, mainUser.Id, relatedInviteId: usedInvite.Id, now: now.AddMinutes(3));
    await EnsureAuditAsync(db, server.Id, ServerGovernanceIds.AuditRoleCreated, mainUser.Id, relatedRoleId: adminRole.Id, now: now.AddMinutes(4));
    await EnsureAuditAsync(db, server.Id, ServerGovernanceIds.AuditRoleAssigned, mainUser.Id, targetUserId: users[3].Id, relatedRoleId: moderatorRole.Id, now: now.AddMinutes(5));
    if (textSpaces.Count > 4)
    {
        await EnsureAuditAsync(db, server.Id, ServerGovernanceIds.AuditSpaceOverrideUpserted, mainUser.Id, relatedSpaceId: textSpaces[4].Id, now: now.AddMinutes(6));
    }
}

static async Task EnsureFriendRequestStatesAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> users,
    DateTime now)
{
    foreach (var user in users.Skip(30).Take(10))
    {
        await EnsureFriendRequestAsync(db, user.Id, mainUser.Id, FriendRequestStatusIds.Pending, now);
    }

    foreach (var user in users.Skip(40).Take(10))
    {
        await EnsureFriendRequestAsync(db, mainUser.Id, user.Id, FriendRequestStatusIds.Pending, now);
    }

    foreach (var user in users.Skip(60).Take(5))
    {
        await EnsureFriendRequestAsync(db, user.Id, mainUser.Id, FriendRequestStatusIds.Declined, now);
    }

    foreach (var user in users.Skip(65).Take(5))
    {
        await EnsureFriendRequestAsync(db, mainUser.Id, user.Id, FriendRequestStatusIds.Canceled, now);
    }
}

static async Task EnsureAdditionalPrivateSpacesAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> users,
    DateTime now)
{
    foreach (var user in users.Skip(70).Take(10))
    {
        var space = await EnsureDirectPrivateSpaceAsync(db, mainUser, user, now);
        await EnsureSpaceMessagesAsync(db, space.SpaceId, [mainUser, user], 1, $"One-message DM {user.Login}", now);
    }

    foreach (var user in users.Skip(80).Take(10))
    {
        await EnsureDirectPrivateSpaceAsync(db, mainUser, user, now);
    }

    for (var index = 1; index <= 5; index++)
    {
        var members = users.Skip(index * 6).Take(index + 2).Prepend(mainUser).ToList();
        var space = await EnsureGroupPrivateSpaceAsync(db, mainUser, members, $"Load group private {index:00}", now);
        await EnsureSpaceMessagesAsync(db, space.SpaceId, members, 10 + index * 4, $"Group private {index:00}", now.AddHours(index));
    }
}

static async Task EnsureAttachmentMessagesAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> users,
    Server server,
    Space textSpace,
    DateTime now)
{
    var existing = await db.SpaceMessages.AnyAsync(x =>
        x.SpaceId == textSpace.Id &&
        x.Body != null &&
        x.Body.StartsWith("ATTACHMENT_SEED"));

    if (existing)
    {
        return;
    }

    var imageAsset = await EnsureSeedAssetAsync(
        db,
        mainUser.Id,
        AssetTypeIds.MessageAttachment,
        "fixture-image.svg",
        "image/svg+xml",
        BuildAttachmentSvgBytes("Fixture image"),
        now,
        width: 320,
        height: 180);
    var gifAsset = await EnsureSeedAssetAsync(
        db,
        users[1].Id,
        AssetTypeIds.MessageAttachment,
        "fixture-animation.gif",
        "image/gif",
        Convert.FromBase64String("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="),
        now.AddMinutes(1),
        width: 1,
        height: 1);
    var zipAsset = await EnsureSeedAssetAsync(
        db,
        users[2].Id,
        AssetTypeIds.MessageAttachment,
        "fixture-archive.zip",
        "application/zip",
        Encoding.UTF8.GetBytes("fixture zip placeholder"),
        now.AddMinutes(2));
    var regAsset = await EnsureSeedAssetAsync(
        db,
        users[3].Id,
        AssetTypeIds.MessageAttachment,
        "fixture-danger.reg",
        "application/octet-stream",
        Encoding.UTF8.GetBytes("Windows Registry Editor Version 5.00"),
        now.AddMinutes(3));

    await AddMessageWithAssetsAsync(db, textSpace.Id, mainUser.Id, "ATTACHMENT_SEED image with text", [imageAsset.Id], now.AddMinutes(10));
    await AddMessageWithAssetsAsync(db, textSpace.Id, users[1].Id, "ATTACHMENT_SEED gif with text", [gifAsset.Id], now.AddMinutes(11));
    await AddMessageWithAssetsAsync(db, textSpace.Id, users[2].Id, "ATTACHMENT_SEED archive warning case", [zipAsset.Id], now.AddMinutes(12));
    await AddMessageWithAssetsAsync(db, textSpace.Id, users[3].Id, "ATTACHMENT_SEED registry warning case", [regAsset.Id], now.AddMinutes(13));
    await AddMessageWithAssetsAsync(db, textSpace.Id, mainUser.Id, null, [imageAsset.Id, gifAsset.Id, zipAsset.Id], now.AddMinutes(14));
}

static async Task<ServerMember> EnsureServerMemberAsync(
    AppDbContext db,
    Guid serverId,
    Guid userId,
    Guid addedByUserId,
    DateTime now)
{
    var member = await db.ServerMembers.FirstOrDefaultAsync(x => x.ServerId == serverId && x.UserId == userId);
    if (member != null)
    {
        if (member.StatusId != ServerMemberStatusIds.Active)
        {
            member.StatusId = ServerMemberStatusIds.Active;
            member.LeftAt = null;
            member.UpdatedAt = now;
            await db.SaveChangesAsync();
        }

        return member;
    }

    member = CreateServerMember(serverId, userId, addedByUserId, now);
    db.ServerMembers.Add(member);
    await db.SaveChangesAsync();
    return member;
}

static async Task<Space> EnsureSpaceAsync(
    AppDbContext db,
    Guid serverId,
    Guid createdByUserId,
    string title,
    Guid typeId,
    int position,
    DateTime now)
{
    var space = await db.Spaces.FirstOrDefaultAsync(x =>
        x.ServerId == serverId &&
        x.Title == title &&
        x.TypeId == typeId &&
        x.DeletedAt == null);
    if (space != null)
    {
        return space;
    }

    space = new Space
    {
        Id = Guid.NewGuid(),
        ServerId = serverId,
        TypeId = typeId,
        CreatedByUserId = createdByUserId,
        Title = title,
        Position = position,
        IsSystem = false,
        CreatedAt = now,
        UpdatedAt = now
    };
    db.Spaces.Add(space);
    await db.SaveChangesAsync();
    return space;
}

static async Task EnsureSpaceMessagesAsync(
    AppDbContext db,
    Guid spaceId,
    IReadOnlyList<User> senders,
    int targetCount,
    string context,
    DateTime startAt)
{
    var currentCount = await db.SpaceMessages.CountAsync(x => x.SpaceId == spaceId && x.DeletedAt == null);
    if (currentCount >= targetCount)
    {
        return;
    }

    var lastCreatedAt = await db.SpaceMessages
        .Where(x => x.SpaceId == spaceId)
        .MaxAsync(x => (DateTime?)x.CreatedAt) ?? startAt;
    for (var index = currentCount; index < targetCount; index++)
    {
        var createdAt = lastCreatedAt.AddMinutes(index - currentCount + 1);
        var isLong = index % 37 == 0;
        var marker = index switch
        {
            7 => " SEARCH_ALPHA",
            13 => " SEARCH_LONG_THREAD",
            19 => " кириллица_поиск",
            _ => string.Empty
        };
        db.SpaceMessages.Add(new SpaceMessage
        {
            Id = Guid.NewGuid(),
            SpaceId = spaceId,
            SenderUserId = senders[index % senders.Count].Id,
            MessageTypeId = SpaceIds.MessageTypeText,
            Body = isLong
                ? $"{context} message {index + 1:000}.{marker} Long seeded body for wrapping and scroll testing. " +
                  "This sentence is intentionally repeated to create a dense message surface. " +
                  "This sentence is intentionally repeated to create a dense message surface."
                : $"{context} message {index + 1:000}.{marker}",
            CreatedAt = createdAt,
            UpdatedAt = createdAt
        });
    }

    await db.SaveChangesAsync();
}

static async Task<ServerRole> EnsureServerRoleAsync(
    AppDbContext db,
    Guid serverId,
    string code,
    string title,
    int level,
    DateTime now)
{
    var role = await db.ServerRoles.FirstOrDefaultAsync(x => x.ServerId == serverId && x.Code == code);
    if (role != null)
    {
        return role;
    }

    role = new ServerRole
    {
        Id = Guid.NewGuid(),
        ServerId = serverId,
        Code = code,
        Title = title,
        Description = $"Fixture {title} role",
        Level = level,
        IsSystem = false,
        CreatedAt = now,
        UpdatedAt = now
    };
    db.ServerRoles.Add(role);
    await db.SaveChangesAsync();
    return role;
}

static async Task EnsureRolePermissionAsync(AppDbContext db, Guid roleId, Guid permissionId, DateTime now)
{
    if (await db.ServerRolePermissions.AnyAsync(x => x.RoleId == roleId && x.PermissionId == permissionId))
    {
        return;
    }

    db.ServerRolePermissions.Add(new ServerRolePermission
    {
        RoleId = roleId,
        PermissionId = permissionId,
        IsGranted = true,
        CreatedAt = now
    });
    await db.SaveChangesAsync();
}

static async Task AssignRoleToUsersAsync(
    AppDbContext db,
    Guid serverId,
    Guid assignedByUserId,
    IEnumerable<User> users,
    Guid roleId,
    DateTime now)
{
    foreach (var user in users)
    {
        var member = await db.ServerMembers.FirstOrDefaultAsync(x => x.ServerId == serverId && x.UserId == user.Id);
        if (member == null)
        {
            continue;
        }

        if (await db.ServerMemberRoles.AnyAsync(x => x.ServerId == serverId && x.MemberId == member.Id && x.RoleId == roleId))
        {
            continue;
        }

        db.ServerMemberRoles.Add(new ServerMemberRole
        {
            Id = Guid.NewGuid(),
            ServerId = serverId,
            MemberId = member.Id,
            RoleId = roleId,
            AssignedByUserId = assignedByUserId,
            AssignedAt = now
        });
    }

    await db.SaveChangesAsync();
}

static async Task EnsureSpaceOverrideAsync(
    AppDbContext db,
    Guid spaceId,
    Guid roleId,
    Guid permissionId,
    bool allow,
    DateTime now)
{
    if (await db.SpacePermissionOverrides.AnyAsync(x =>
            x.SpaceId == spaceId &&
            x.RoleId == roleId &&
            x.PermissionId == permissionId &&
            x.Allow == allow &&
            x.Deny == !allow))
    {
        return;
    }

    db.SpacePermissionOverrides.Add(new SpacePermissionOverride
    {
        Id = Guid.NewGuid(),
        SpaceId = spaceId,
        RoleId = roleId,
        PermissionId = permissionId,
        Allow = allow,
        Deny = !allow,
        CreatedAt = now
    });
    await db.SaveChangesAsync();
}

static async Task<ServerInvite> EnsureInviteAsync(
    AppDbContext db,
    Guid serverId,
    Guid createdByUserId,
    string code,
    int? maxUses,
    DateTime? expiresAt,
    DateTime now)
{
    var invite = await db.ServerInvites.FirstOrDefaultAsync(x => x.Code == code);
    if (invite != null)
    {
        return invite;
    }

    invite = new ServerInvite
    {
        Id = Guid.NewGuid(),
        ServerId = serverId,
        CreatedByUserId = createdByUserId,
        KindId = ServerGovernanceIds.InviteKindLink,
        Code = code,
        MaxUses = maxUses,
        ExpiresAt = expiresAt,
        CreatedAt = now,
        UsedCount = 0
    };
    db.ServerInvites.Add(invite);
    await db.SaveChangesAsync();
    return invite;
}

static async Task EnsureInviteUsageAsync(AppDbContext db, ServerInvite invite, Guid userId, DateTime usedAt)
{
    if (await db.ServerInviteUsages.AnyAsync(x => x.InviteId == invite.Id && x.UserId == userId))
    {
        return;
    }

    db.ServerInviteUsages.Add(new ServerInviteUsage
    {
        Id = Guid.NewGuid(),
        InviteId = invite.Id,
        UserId = userId,
        UsedAt = usedAt
    });
    invite.UsedCount += 1;
    await db.SaveChangesAsync();
}

static async Task EnsureAuditAsync(
    AppDbContext db,
    Guid serverId,
    Guid eventTypeId,
    Guid? actorUserId,
    Guid? targetUserId = null,
    Guid? relatedRoleId = null,
    Guid? relatedInviteId = null,
    Guid? relatedSpaceId = null,
    DateTime? now = null)
{
    var createdAt = now ?? DateTime.UtcNow;
    if (await db.ServerAuditLogs.AnyAsync(x =>
            x.ServerId == serverId &&
            x.EventTypeId == eventTypeId &&
            x.RelatedRoleId == relatedRoleId &&
            x.RelatedInviteId == relatedInviteId &&
            x.RelatedSpaceId == relatedSpaceId))
    {
        return;
    }

    db.ServerAuditLogs.Add(new ServerAuditLog
    {
        Id = Guid.NewGuid(),
        ServerId = serverId,
        EventTypeId = eventTypeId,
        ActorUserId = actorUserId,
        TargetUserId = targetUserId,
        RelatedRoleId = relatedRoleId,
        RelatedInviteId = relatedInviteId,
        RelatedSpaceId = relatedSpaceId,
        Payload = "{\"source\":\"test-data-seeder\"}",
        CreatedAt = createdAt
    });
    await db.SaveChangesAsync();
}

static async Task EnsureFriendRequestAsync(
    AppDbContext db,
    Guid fromUserId,
    Guid toUserId,
    Guid statusId,
    DateTime now)
{
    if (await db.FriendRequests.AnyAsync(x => x.FromUserId == fromUserId && x.ToUserId == toUserId && x.StatusId == statusId))
    {
        return;
    }

    var terminal = statusId != FriendRequestStatusIds.Pending;
    db.FriendRequests.Add(new FriendRequest
    {
        Id = Guid.NewGuid(),
        FromUserId = fromUserId,
        ToUserId = toUserId,
        StatusId = statusId,
        CreatedAt = now,
        UpdatedAt = terminal ? now.AddMinutes(1) : now,
        RespondedAt = terminal ? now.AddMinutes(1) : null
    });
    await db.SaveChangesAsync();
}

static async Task<PrivateSpace> EnsureDirectPrivateSpaceAsync(
    AppDbContext db,
    User mainUser,
    User friend,
    DateTime now)
{
    var existing = await db.PrivateSpaces
        .Include(x => x.Space)
        .Include(x => x.Members)
        .FirstOrDefaultAsync(x =>
            x.DeletedAt == null &&
            x.Members.Count == 2 &&
            x.Members.Any(member => member.UserId == mainUser.Id) &&
            x.Members.Any(member => member.UserId == friend.Id));
    if (existing != null)
    {
        return existing;
    }

    var space = new Space
    {
        Id = Guid.NewGuid(),
        TypeId = SpaceIds.TypeTextRoom,
        CreatedByUserId = mainUser.Id,
        Title = friend.Profile.DisplayName,
        Position = 0,
        IsSystem = false,
        CreatedAt = now,
        UpdatedAt = now
    };
    var privateSpace = new PrivateSpace
    {
        SpaceId = space.Id,
        Space = space,
        CreatedByUserId = mainUser.Id,
        CreatedAt = now,
        UpdatedAt = now
    };
    privateSpace.Members.Add(CreatePrivateSpaceMember(space.Id, mainUser.Id, null, now));
    privateSpace.Members.Add(CreatePrivateSpaceMember(space.Id, friend.Id, mainUser.Id, now));
    db.PrivateSpaces.Add(privateSpace);
    await db.SaveChangesAsync();
    return privateSpace;
}

static async Task<PrivateSpace> EnsureGroupPrivateSpaceAsync(
    AppDbContext db,
    User mainUser,
    IReadOnlyList<User> members,
    string title,
    DateTime now)
{
    var existing = await db.PrivateSpaces
        .Include(x => x.Space)
        .Include(x => x.Members)
        .FirstOrDefaultAsync(x => x.Title == title && x.DeletedAt == null);
    if (existing != null)
    {
        return existing;
    }

    var space = new Space
    {
        Id = Guid.NewGuid(),
        TypeId = SpaceIds.TypeTextRoom,
        CreatedByUserId = mainUser.Id,
        Title = title,
        Position = 0,
        IsSystem = false,
        CreatedAt = now,
        UpdatedAt = now
    };
    var privateSpace = new PrivateSpace
    {
        SpaceId = space.Id,
        Space = space,
        CreatedByUserId = mainUser.Id,
        Title = title,
        CreatedAt = now,
        UpdatedAt = now
    };

    foreach (var member in members.DistinctBy(x => x.Id))
    {
        privateSpace.Members.Add(CreatePrivateSpaceMember(
            space.Id,
            member.Id,
            member.Id == mainUser.Id ? null : mainUser.Id,
            now));
    }

    db.PrivateSpaces.Add(privateSpace);
    await db.SaveChangesAsync();
    return privateSpace;
}

static async Task<Asset> EnsureSeedAssetAsync(
    AppDbContext db,
    Guid ownerUserId,
    Guid assetTypeId,
    string fileName,
    string mimeType,
    byte[] bytes,
    DateTime now,
    int? width = null,
    int? height = null)
{
    var existing = await db.Assets.FirstOrDefaultAsync(x =>
        x.OwnerUserId == ownerUserId &&
        x.OriginalFileName == fileName &&
        x.AssetTypeId == assetTypeId &&
        x.DeletedAt == null);
    if (existing != null)
    {
        await EnsureAssetFileAsync(existing.StorageKey, bytes);
        return existing;
    }

    var id = Guid.NewGuid();
    var extension = Path.GetExtension(fileName);
    var typeCode = assetTypeId == AssetTypeIds.Avatar
        ? "avatar"
        : assetTypeId == AssetTypeIds.ServerIcon
            ? "server_icon"
            : assetTypeId == AssetTypeIds.ProfileBackground
                ? "profile_background"
                : "message_attachment";
    var storageKey = Path.Combine("assets", typeCode, ownerUserId.ToString(), $"{id}{extension}")
        .Replace('\\', '/');
    await EnsureAssetFileAsync(storageKey, bytes);

    var asset = new Asset
    {
        Id = id,
        OwnerUserId = ownerUserId,
        AssetTypeId = assetTypeId,
        StorageKey = storageKey,
        OriginalFileName = fileName,
        MimeType = mimeType,
        SizeBytes = bytes.LongLength,
        Sha256 = Convert.ToHexString(SHA256.HashData(bytes)),
        Width = width,
        Height = height,
        CreatedAt = now
    };
    db.Assets.Add(asset);
    await db.SaveChangesAsync();
    return asset;
}

static Task EnsureAssetFileAsync(string storageKey, byte[] bytes)
{
    var storageRoot = ResolveBackendPath(
        "ARCANELINK_SEED_STORAGE_PATH",
        "ArcaneLink",
        "storage");
    var path = Path.GetFullPath(Path.Combine(
        storageRoot,
        storageKey.Replace('/', Path.DirectorySeparatorChar)));
    var storageBoundary = storageRoot.EndsWith(Path.DirectorySeparatorChar)
        ? storageRoot
        : storageRoot + Path.DirectorySeparatorChar;
    if (!path.StartsWith(storageBoundary, StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException("Generated asset path escapes the configured storage directory.");
    }

    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    if (!File.Exists(path))
    {
        File.WriteAllBytes(path, bytes);
    }

    return Task.CompletedTask;
}

static async Task AddMessageWithAssetsAsync(
    AppDbContext db,
    Guid spaceId,
    Guid senderUserId,
    string? body,
    IReadOnlyList<Guid> assetIds,
    DateTime createdAt)
{
    var message = new SpaceMessage
    {
        Id = Guid.NewGuid(),
        SpaceId = spaceId,
        SenderUserId = senderUserId,
        MessageTypeId = assetIds.Count > 0 ? SpaceIds.MessageTypeMedia : SpaceIds.MessageTypeText,
        Body = body,
        CreatedAt = createdAt,
        UpdatedAt = createdAt
    };

    for (var index = 0; index < assetIds.Count; index++)
    {
        message.Assets.Add(new SpaceMessageAsset
        {
            MessageId = message.Id,
            AssetId = assetIds[index],
            DisplayOrder = index
        });
    }

    db.SpaceMessages.Add(message);
    await db.SaveChangesAsync();
}

static byte[] BuildAvatarSvgBytes(int index)
{
    var colors = new[] { "#8EA2EE", "#64D2A6", "#F5A524", "#F472B6", "#38BDF8", "#A78BFA" };
    var fill = colors[index % colors.Length];
    var svg = $"""
        <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
          <rect width="128" height="128" rx="32" fill="#121a34"/>
          <circle cx="64" cy="54" r="28" fill="{fill}"/>
          <path d="M24 118c8-24 24-36 40-36s32 12 40 36" fill="{fill}" opacity=".72"/>
        </svg>
        """;
    return Encoding.UTF8.GetBytes(svg);
}

static byte[] BuildAttachmentSvgBytes(string label)
{
    var svg = $"""
        <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
          <rect width="320" height="180" rx="18" fill="#111827"/>
          <rect x="22" y="22" width="276" height="136" rx="14" fill="#26324f"/>
          <text x="160" y="96" text-anchor="middle" fill="#dbeafe" font-family="Arial" font-size="22">{label}</text>
          <text x="160" y="124" text-anchor="middle" fill="#93c5fd" font-family="Arial" font-size="14">SEARCH_ATTACHMENT</text>
        </svg>
        """;
    return Encoding.UTF8.GetBytes(svg);
}

static async Task PrintFixtureSummaryAsync(AppDbContext db, User mainUser, Server bigServer)
{
    var serverCount = await db.ServerMembers
        .Where(x => x.UserId == mainUser.Id && x.Server.Slug.StartsWith("load-lab"))
        .Select(x => x.ServerId)
        .Distinct()
        .CountAsync();
    var bigServerMemberCount = await db.ServerMembers
        .CountAsync(x => x.ServerId == bigServer.Id && x.StatusId == ServerMemberStatusIds.Active);
    var bigServerTextCount = await db.Spaces
        .CountAsync(x => x.ServerId == bigServer.Id && x.TypeId == SpaceIds.TypeTextRoom && x.DeletedAt == null);
    var bigServerVoiceCount = await db.Spaces
        .CountAsync(x => x.ServerId == bigServer.Id && x.TypeId == SpaceIds.TypeVoiceRoom && x.DeletedAt == null);
    var bigServerMessageCount = await db.SpaceMessages
        .CountAsync(x => x.Space.ServerId == bigServer.Id && x.DeletedAt == null);
    var attachmentMessageCount = await db.SpaceMessageAssets
        .Select(x => x.MessageId)
        .Distinct()
        .CountAsync();
    var roleCount = await db.ServerRoles
        .CountAsync(x => x.ServerId == bigServer.Id && x.Code != null && x.Code.StartsWith("fixture-"));
    var inviteCount = await db.ServerInvites
        .CountAsync(x => x.ServerId == bigServer.Id && x.Code != null && x.Code.StartsWith("LOAD-"));
    var pendingIncoming = await db.FriendRequests
        .CountAsync(x => x.ToUserId == mainUser.Id && x.StatusId == FriendRequestStatusIds.Pending);
    var pendingOutgoing = await db.FriendRequests
        .CountAsync(x => x.FromUserId == mainUser.Id && x.StatusId == FriendRequestStatusIds.Pending);
    var directSpaceCount = await db.PrivateSpaceMembers
        .Where(x => x.UserId == mainUser.Id && x.PrivateSpace.Members.Count == 2)
        .Select(x => x.SpaceId)
        .Distinct()
        .CountAsync();
    var groupSpaceCount = await db.PrivateSpaces
        .CountAsync(x => x.Title != null && x.Title.StartsWith("Load group private"));
    var activeUsers = await db.Users.CountAsync(x => x.Login.StartsWith("load_") && x.StatusId == UserStatusIds.Active);
    var bannedUsers = await db.Users.CountAsync(x => x.Login.StartsWith("load_") && x.StatusId == UserStatusIds.Banned);
    var deletedUsers = await db.Users.CountAsync(x => x.Login.StartsWith("load_") && x.StatusId == UserStatusIds.Deleted);
    var freeUsers = await db.Users.CountAsync(x => x.Login.StartsWith("load_") && x.SubscriptionTypeId == SubscriptionTypeIds.Free);
    var plusUsers = await db.Users.CountAsync(x => x.Login.StartsWith("load_") && x.SubscriptionTypeId == SubscriptionTypeIds.Plus);
    var primeUsers = await db.Users.CountAsync(x => x.Login.StartsWith("load_") && x.SubscriptionTypeId == SubscriptionTypeIds.Prime);
    var mainSubscription = await db.Users
        .Where(x => x.Id == mainUser.Id)
        .Select(x => x.SubscriptionType.Code)
        .FirstAsync();

    Console.WriteLine(
        $"Fixture summary: servers={serverCount}, bigServerMembers={bigServerMemberCount}, " +
        $"bigServerText={bigServerTextCount}, bigServerVoice={bigServerVoiceCount}, " +
        $"bigServerMessages={bigServerMessageCount}, attachmentMessages={attachmentMessageCount}, " +
        $"roles={roleCount}, invites={inviteCount}, pendingIncoming={pendingIncoming}, " +
        $"pendingOutgoing={pendingOutgoing}, directSpaces={directSpaceCount}, groupSpaces={groupSpaceCount}, " +
        $"userStatuses=active:{activeUsers}/banned:{bannedUsers}/deleted:{deletedUsers}, " +
        $"subscriptions=free:{freeUsers}/plus:{plusUsers}/prime:{primeUsers}, mainSubscription={mainSubscription}.");
}

static async Task WriteCredentialsFilesAsync(
    AppDbContext db,
    string mainPassword,
    string generatedUserPassword)
{
    var outputDirectory = ResolveBackendPath(
        "ARCANELINK_SEED_OUTPUT_PATH",
        "artifacts",
        "test-data");
    Directory.CreateDirectory(outputDirectory);

    var generatedUsers = await db.Users
        .AsNoTracking()
        .Include(x => x.Profile)
        .Where(x => x.Login.StartsWith("load_user_"))
        .OrderBy(x => x.Login)
        .Select(x => new
        {
            x.Id,
            x.Login,
            x.Email,
            x.Profile.DisplayName
        })
        .ToListAsync();

    var mainFile = Path.Combine(outputDirectory, "main-user-login.txt");
    await File.WriteAllTextAsync(
        mainFile,
        $"""
        ArcaneLink generated test main account
        Login: load_main
        Password: {mainPassword}
        Email: load_main@arcanelink.test
        Owns: 30 servers
        Friends: load_user_001 through load_user_030
        Seeded direct dialogs: load_user_001 through load_user_030
        Shared test server: load-lab-01, with 100 generated users as active members
        """,
        Encoding.UTF8);

    var usersFile = Path.Combine(outputDirectory, "generated-users-login.txt");
    var builder = new StringBuilder();
    builder.AppendLine("ArcaneLink generated test users");
    builder.AppendLine($"All generated users have the same password: {generatedUserPassword}");
    builder.AppendLine();
    builder.AppendLine("login,password,email,display_name,user_id");

    foreach (var user in generatedUsers)
    {
        builder.AppendLine($"{user.Login},{generatedUserPassword},{user.Email},{user.DisplayName},{user.Id}");
    }

    await File.WriteAllTextAsync(usersFile, builder.ToString(), Encoding.UTF8);
}

static string ReadRequiredEnvironmentVariable(string name)
{
    var value = Environment.GetEnvironmentVariable(name);
    if (string.IsNullOrWhiteSpace(value))
    {
        throw new InvalidOperationException(
            $"Environment variable '{name}' must be set before running the test-data seeder.");
    }

    return value;
}

static string ResolveBackendPath(string environmentVariableName, params string[] relativeSegments)
{
    var configuredPath = Environment.GetEnvironmentVariable(environmentVariableName);
    if (!string.IsNullOrWhiteSpace(configuredPath))
    {
        return Path.GetFullPath(configuredPath);
    }

    return Path.GetFullPath(Path.Combine([ResolveBackendDirectory(), .. relativeSegments]));
}

static string ResolveBackendDirectory()
{
    var startingDirectories = new[]
    {
        new DirectoryInfo(Directory.GetCurrentDirectory()),
        new DirectoryInfo(AppContext.BaseDirectory)
    };

    foreach (var startingDirectory in startingDirectories)
    {
        for (var current = startingDirectory; current is not null; current = current.Parent)
        {
            var directProject = Path.Combine(current.FullName, "ArcaneLink", "ArcaneLink.csproj");
            if (File.Exists(directProject))
            {
                return current.FullName;
            }

            var nestedBackendProject = Path.Combine(
                current.FullName,
                "backend",
                "ArcaneLink",
                "ArcaneLink.csproj");
            if (File.Exists(nestedBackendProject))
            {
                return Path.Combine(current.FullName, "backend");
            }
        }
    }

    throw new DirectoryNotFoundException(
        "Could not locate the backend directory. Set ARCANELINK_SEED_STORAGE_PATH and " +
        "ARCANELINK_SEED_OUTPUT_PATH explicitly.");
}
