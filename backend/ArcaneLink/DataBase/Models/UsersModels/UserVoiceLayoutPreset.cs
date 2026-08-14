namespace ArcaneLink.DataBase.Models.UsersModels
{
    public class UserVoiceLayoutPreset
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public required string Name { get; set; }

        public bool IsPinned { get; set; }
        public bool ShowParticipantsWithoutVideo { get; set; }
        public bool HideServiceInfo { get; set; }

        public int GridColumns { get; set; }
        public int GridRows { get; set; }
        public int CellSizePx { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public ICollection<UserVoiceLayoutPresetSlot> Slots { get; set; } = [];
    }
}
