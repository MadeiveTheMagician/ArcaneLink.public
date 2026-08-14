namespace ArcaneLink.DataBase.Models.SpacesModels
{
    public class PrivateSpaceFolderItem
    {
        public Guid FolderId { get; set; }
        public Guid SpaceId { get; set; }
        public int Position { get; set; }
        public DateTime ActivityAt { get; set; }
        public DateTime? PinnedAt { get; set; }
        public DateTime CreatedAt { get; set; }

        public PrivateSpaceFolder Folder { get; set; } = null!;
        public PrivateSpace PrivateSpace { get; set; } = null!;
    }
}
