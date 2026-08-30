using System.Security.Cryptography;
using System.Text.Json;
using ArcaneLink.DataBase.Models.MessagesModels;

namespace ArcaneLink.Services.Moderation;

public static class ModerationEvidenceHasher
{
    public static string Compute(
        SpaceMessage message,
        IEnumerable<SpaceMessageAsset> attachments)
    {
        using var canonical = new MemoryStream();
        using (var writer = new Utf8JsonWriter(canonical))
        {
            writer.WriteStartObject();
            WriteNullableString(writer, "body", message.Body);
            WriteNullableString(writer, "payload", message.Payload);
            writer.WriteStartArray("attachments");

            foreach (var attachment in attachments
                         .OrderBy(x => x.DisplayOrder)
                         .ThenBy(x => x.AssetId))
            {
                writer.WriteStartObject();
                writer.WriteString("assetId", attachment.AssetId);
                writer.WriteNumber("displayOrder", attachment.DisplayOrder);
                WriteNullableString(writer, "displayName", attachment.DisplayName);
                writer.WriteBoolean("isSpoiler", attachment.IsSpoiler);
                WriteNullableString(
                    writer,
                    "originalFileName",
                    attachment.Asset.OriginalFileName);
                writer.WriteString("mimeType", attachment.Asset.MimeType);
                writer.WriteNumber("sizeBytes", attachment.Asset.SizeBytes);
                writer.WriteString("sha256", attachment.Asset.Sha256);
                WriteNullableNumber(writer, "width", attachment.Asset.Width);
                WriteNullableNumber(writer, "height", attachment.Asset.Height);
                writer.WriteString("createdAt", attachment.Asset.CreatedAt);
                writer.WriteEndObject();
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
        }

        return Convert.ToHexString(SHA256.HashData(canonical.ToArray()))
            .ToLowerInvariant();
    }

    private static void WriteNullableString(
        Utf8JsonWriter writer,
        string propertyName,
        string? value)
    {
        if (value == null)
        {
            writer.WriteNull(propertyName);
            return;
        }

        writer.WriteString(propertyName, value);
    }

    private static void WriteNullableNumber(
        Utf8JsonWriter writer,
        string propertyName,
        int? value)
    {
        if (value == null)
        {
            writer.WriteNull(propertyName);
            return;
        }

        writer.WriteNumber(propertyName, value.Value);
    }
}
