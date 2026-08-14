using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.Services.Messages
{
    internal static class SpaceMessageMapper
    {
        public static SpaceMessageResponse ToResponse(
            SpaceMessage message,
            Guid currentUserId,
            bool includeDeletedContent = false)
        {
            var showContent = message.DeletedAt == null || includeDeletedContent;
            var senderIdentity = ResolveIdentity(
                message.SenderUser,
                message.Space.ServerId);
            return new SpaceMessageResponse
            {
                Id = message.Id,
                ServerId = message.Space.ServerId ?? Guid.Empty,
                SpaceId = message.SpaceId,
                SenderUserId = message.SenderUserId,
                SenderDisplayName = senderIdentity.DisplayName,
                SenderAvatarAssetId = senderIdentity.AvatarAssetId,
                SenderAvatarCropOffsetX = senderIdentity.AvatarCropOffsetX,
                SenderAvatarCropOffsetY = senderIdentity.AvatarCropOffsetY,
                SenderAvatarCropZoom = senderIdentity.AvatarCropZoom,
                MessageTypeId = message.MessageTypeId,
                MessageTypeCode = message.MessageType.Code,
                Body = showContent ? message.Body : null,
                Payload = showContent ? message.Payload : null,
                ReplyToMessageId = message.ReplyToMessageId,
                ReplyTo = MapReplyPreview(message, currentUserId),
                CreatedAt = message.CreatedAt,
                UpdatedAt = message.UpdatedAt,
                EditedAt = message.EditedAt,
                DeletedAt = message.DeletedAt,
                Assets = showContent
                    ? message.Assets
                        .OrderBy(asset => asset.DisplayOrder)
                        .Select(asset => new SpaceMessageAssetResponse
                        {
                            AssetId = asset.AssetId,
                            DisplayOrder = asset.DisplayOrder,
                            FileName = asset.DisplayName ??
                                       asset.Asset.OriginalFileName ??
                                       Path.GetFileName(asset.Asset.StorageKey),
                            MimeType = asset.Asset.MimeType,
                            SizeBytes = asset.Asset.SizeBytes,
                            CreatedAt = asset.Asset.CreatedAt,
                            IsSpoiler = asset.IsSpoiler
                        })
                        .ToList()
                    : [],
                Reactions = message.Reactions
                    .GroupBy(reaction => reaction.EmojiCode)
                    .Select(group => new SpaceMessageReactionResponse
                    {
                        EmojiCode = group.Key,
                        Count = group.Count(),
                        ReactedByCurrentUser = group.Any(reaction =>
                            reaction.UserId == currentUserId)
                    })
                    .ToList(),
                Mentions = showContent
                    ? message.Mentions
                        .OrderBy(mention => mention.Start)
                        .Select(mention => new SpaceMessageMentionResponse
                        {
                            Id = mention.Id,
                            Kind = mention.Kind,
                            TargetUserId = mention.TargetUserId,
                            TargetRoleId = mention.TargetRoleId,
                            DisplayText = mention.DisplayText,
                            Start = mention.Start,
                            Length = mention.Length
                        })
                        .ToList()
                    : []
            };
        }

        private static SpaceMessageReplyPreviewResponse? MapReplyPreview(
            SpaceMessage message,
            Guid currentUserId)
        {
            if (!message.ReplyToMessageId.HasValue)
            {
                return null;
            }

            var reply = message.ReplyToMessage;
            var unavailable = reply == null ||
                              reply.DeletedAt != null ||
                              reply.UserDeletions.Any(x => x.UserId == currentUserId);
            if (reply == null)
            {
                return new SpaceMessageReplyPreviewResponse
                {
                    Id = message.ReplyToMessageId.Value,
                    IsUnavailable = true
                };
            }

            var senderIdentity = ResolveIdentity(
                reply.SenderUser,
                message.Space.ServerId);

            return new SpaceMessageReplyPreviewResponse
            {
                Id = reply.Id,
                SenderUserId = reply.SenderUserId,
                SenderDisplayName = unavailable ? null : senderIdentity.DisplayName,
                SenderAvatarAssetId = unavailable ? null : senderIdentity.AvatarAssetId,
                SenderAvatarCropOffsetX = unavailable
                    ? 0
                    : senderIdentity.AvatarCropOffsetX,
                SenderAvatarCropOffsetY = unavailable
                    ? 0
                    : senderIdentity.AvatarCropOffsetY,
                SenderAvatarCropZoom = unavailable
                    ? 1
                    : senderIdentity.AvatarCropZoom,
                Body = unavailable ? null : reply.Body,
                CreatedAt = reply.CreatedAt,
                IsUnavailable = unavailable
            };
        }

        private static MessageAuthorIdentity ResolveIdentity(
            User user,
            Guid? serverId)
        {
            var global = user.Profile;
            var serverProfile = serverId.HasValue
                ? user.ServerMemberships
                    .FirstOrDefault(member => member.ServerId == serverId.Value)
                    ?.ServerProfile
                : null;
            var usesServerAvatar = serverProfile?.AvatarAssetId != null;

            return new MessageAuthorIdentity(
                serverProfile?.DisplayName ?? global.DisplayName,
                serverProfile?.AvatarAssetId ?? global.AvatarAssetId,
                usesServerAvatar
                    ? 0
                    : global.AvatarCropOffsetX,
                usesServerAvatar
                    ? 0
                    : global.AvatarCropOffsetY,
                usesServerAvatar
                    ? 1
                    : global.AvatarCropZoom);
        }

        private sealed record MessageAuthorIdentity(
            string DisplayName,
            Guid? AvatarAssetId,
            double AvatarCropOffsetX,
            double AvatarCropOffsetY,
            double AvatarCropZoom);
    }
}
