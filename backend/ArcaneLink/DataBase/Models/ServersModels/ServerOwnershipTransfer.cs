using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.ServersModels
{
    public class ServerOwnershipTransfer
    {
        public Guid Id { get; set; }

        public Guid ServerId { get; set; }
        public Server Server { get; set; } = null!;

        public Guid FromUserId { get; set; }
        public User FromUser { get; set; } = null!;

        public Guid ToUserId { get; set; }
        public User ToUser { get; set; } = null!;

        public Guid TransferTypeId { get; set; }
        public ServerOwnershipTransferType TransferType { get; set; } = null!;

        public string? Reason { get; set; }

        public Guid ExecutedByUserId { get; set; }
        public User ExecutedByUser { get; set; } = null!;

        public DateTime TransferredAt { get; set; }
    }
}
