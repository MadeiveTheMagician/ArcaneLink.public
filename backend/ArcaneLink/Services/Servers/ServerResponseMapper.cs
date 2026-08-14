using ArcaneLink.DataBase.DTOs.Servers;
using ArcaneLink.DataBase.Models.ServersModels;

namespace ArcaneLink.Services.Servers
{
    internal static class ServerResponseMapper
    {
        internal static ServerResponse ToServerResponse(Server server)
        {
            return new ServerResponse
            {
                Id = server.Id,
                CreatedByUserId = server.CreatedByUserId,
                OwnerUserId = server.OwnerUserId,
                Slug = server.Slug,
                Title = server.Title,
                Description = server.Description,
                IconAssetId = server.IconAssetId,
                IconCropOffsetX = server.IconCropOffsetX,
                IconCropOffsetY = server.IconCropOffsetY,
                IconCropZoom = server.IconCropZoom,
                DefaultTextSpaceId = server.DefaultTextSpaceId,
                AccessMode = server.AccessMode,
                IsSystem = server.IsSystem,
                CreatedAt = server.CreatedAt,
                UpdatedAt = server.UpdatedAt
            };
        }

        internal static ServerMemberResponse ToServerMemberResponse(
            ServerMember member,
            ServerLastMessageResponse? lastMessage = null,
            long unreadCount = 0)
        {
            return new ServerMemberResponse
            {
                Id = member.Id,
                ServerId = member.ServerId,
                UserId = member.UserId,
                StatusCode = member.Status.Code,
                JoinedAt = member.JoinedAt,
                LeftAt = member.LeftAt,
                AddedByUserId = member.AddedByUserId,
                CreatedAt = member.CreatedAt,
                UpdatedAt = member.UpdatedAt,
                UnreadCount = unreadCount,
                Server = ToServerResponse(member.Server),
                LastMessage = lastMessage
            };
        }
    }
}
