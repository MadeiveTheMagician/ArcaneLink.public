using ArcaneLink.DataBase.DTOs.Messages;

namespace ArcaneLink.Services.Messages.Abstractions
{
    public interface ISpaceMessageAttachmentService
    {
        Task<SpaceMessageAttachmentValidationResult> BuildAttachmentsAsync(
            Guid currentUserId,
            Guid messageId,
            IReadOnlyList<CreateSpaceMessageAttachmentRequest> attachments,
            CancellationToken cancellationToken = default);
    }
}
