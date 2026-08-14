using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.DTOs.Messages;
using ArcaneLink.DataBase.Models.MessagesModels;
using ArcaneLink.Services.Assets;
using ArcaneLink.Services.Messages.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Services.Messages
{
    public class SpaceMessageAttachmentService : ISpaceMessageAttachmentService
    {
        private readonly AppDbContext _db;
        private readonly AssetUploadOptions _uploadOptions;

        public SpaceMessageAttachmentService(
            AppDbContext db,
            IOptions<AssetUploadOptions> uploadOptions)
        {
            _db = db;
            _uploadOptions = uploadOptions.Value;
        }

        public async Task<SpaceMessageAttachmentValidationResult> BuildAttachmentsAsync(
            Guid currentUserId,
            Guid messageId,
            IReadOnlyList<CreateSpaceMessageAttachmentRequest> requestedAttachments,
            CancellationToken cancellationToken = default)
        {
            if (requestedAttachments.Count == 0)
            {
                return SpaceMessageAttachmentValidationResult.Valid([]);
            }

            var attachments = requestedAttachments
                .GroupBy(x => x.AssetId)
                .Select(group => group.First())
                .ToList();
            var uniqueAssetIds = attachments.Select(x => x.AssetId).ToList();

            if (uniqueAssetIds.Count > _uploadOptions.MaxAttachmentsPerMessage)
            {
                return SpaceMessageAttachmentValidationResult.Invalid();
            }

            var validAssetIds = await _db.Assets
                .AsNoTracking()
                .Where(x => uniqueAssetIds.Contains(x.Id) &&
                            x.OwnerUserId == currentUserId &&
                            x.AssetTypeId == AssetTypeIds.MessageAttachment &&
                            x.DeletedAt == null)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);

            if (validAssetIds.Count != uniqueAssetIds.Count)
            {
                return SpaceMessageAttachmentValidationResult.Invalid();
            }

            var validAssetIdSet = validAssetIds.ToHashSet();
            var displayOrder = 0;
            var messageAttachments = attachments
                .Where(attachment => validAssetIdSet.Contains(attachment.AssetId))
                .Select(attachment => new SpaceMessageAsset
                {
                    MessageId = messageId,
                    AssetId = attachment.AssetId,
                    DisplayOrder = displayOrder++,
                    DisplayName = NormalizeDisplayName(attachment.DisplayName),
                    IsSpoiler = attachment.IsSpoiler
                })
                .ToList();

            return SpaceMessageAttachmentValidationResult.Valid(messageAttachments);
        }

        private static string? NormalizeDisplayName(string? displayName)
        {
            var normalized = displayName?.Trim();
            return string.IsNullOrWhiteSpace(normalized)
                ? null
                : normalized[..Math.Min(normalized.Length, 255)];
        }
    }
}
