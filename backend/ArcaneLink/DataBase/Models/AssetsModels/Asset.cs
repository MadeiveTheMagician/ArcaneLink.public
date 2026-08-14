using ArcaneLink.DataBase.Models.UsersModels;

namespace ArcaneLink.DataBase.Models.AssetsModels
{
    // Универсальная запись о файле/медиа.
    //
    // Здесь хранятся метаданные и ключ хранения,
    // но не сами байты файла.
    public class Asset
    {
        public Guid Id { get; set; }

        // OwnerUserId nullable, чтобы системные ассеты или осиротевшие записи
        // могли оставаться в истории после удаления пользователя.
        public Guid? OwnerUserId { get; set; }
        public User? OwnerUser { get; set; }

        public Guid AssetTypeId { get; set; }
        public AssetType AssetType { get; set; } = null!;

        // StorageKey — внутренний ключ в storage provider.
        // Это не публичный URL: URL можно строить отдельно через storage service/CDN.
        public required string StorageKey { get; set; }
        public string? OriginalFileName { get; set; }
        public required string MimeType { get; set; }

        public long SizeBytes { get; set; }
        // Sha256 нужен для дедупликации, аудита и проверки целостности файла.
        public required string Sha256 { get; set; }

        // Размеры заполняются только для изображений/визуальных медиа.
        public int? Width { get; set; }
        public int? Height { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public DateTime? PhysicalDeletedAt { get; set; }
    }
}
