namespace ArcaneLink.DataBase.Models.AssetsModels;

// Справочник типов ассетов.
//
// Тип определяет назначение файла: avatar, banner, attachment и т.д.
public class AssetType
{
    public Guid Id { get; set; }

    public required string Code { get; set; }
    public required string Title { get; set; }

    // Позже можно отделить пользовательские загрузки от системных ассетов.
    public bool IsUserUpload { get; set; } = true;

    public ICollection<Asset> Assets { get; set; } = [];
}
