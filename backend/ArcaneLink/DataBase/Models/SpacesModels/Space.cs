using ArcaneLink.DataBase.Models.ServersModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.SpacesModels;

public class Space
{
    public Guid Id { get; set; }

    public Guid? ServerId { get; set; }
    public Server? Server { get; set; }

    public Guid TypeId { get; set; }
    public SpaceType Type { get; set; } = null!;

    public Guid? ParentSpaceId { get; set; }
    public Space? ParentSpace { get; set; }

    public Guid? ParentVoiceSpaceId { get; set; }
    public Space? ParentVoiceSpace { get; set; }
    public Space? VoiceChatSpace { get; set; }

    public Guid CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;

    public required string Title { get; set; }
    public string? Description { get; set; }

    public Guid? RequiredServerRoleId { get; set; }
    public ServerRole? RequiredServerRole { get; set; }

    public Guid? CreatedWithRoleId { get; set; }
    public ServerRole? CreatedWithRole { get; set; }

    public Guid? ProtectionRoleId { get; set; }
    public ServerRole? ProtectionRole { get; set; }

    public int Position { get; set; }
    public bool IsSystem { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public PrivateSpace? PrivateSpace { get; set; }
    public ICollection<Space> ChildSpaces { get; set; } = [];
    public ICollection<SpacePermissionOverride> PermissionOverrides { get; set; } = [];
}
