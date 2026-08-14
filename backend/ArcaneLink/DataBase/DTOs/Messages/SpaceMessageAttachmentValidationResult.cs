using ArcaneLink.DataBase.Models.MessagesModels;

namespace ArcaneLink.DataBase.DTOs.Messages
{
    public class SpaceMessageAttachmentValidationResult
    {
        public bool IsValid { get; init; }
        public IReadOnlyList<SpaceMessageAsset> Attachments { get; init; } = [];

        public static SpaceMessageAttachmentValidationResult Valid(
            IReadOnlyList<SpaceMessageAsset> attachments)
        {
            return new SpaceMessageAttachmentValidationResult
            {
                IsValid = true,
                Attachments = attachments
            };
        }

        public static SpaceMessageAttachmentValidationResult Invalid()
        {
            return new SpaceMessageAttachmentValidationResult
            {
                IsValid = false
            };
        }
    }
}
