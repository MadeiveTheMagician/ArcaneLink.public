using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations;

public class SystemThemeConfiguration : IEntityTypeConfiguration<SystemTheme>
{
    public void Configure(EntityTypeBuilder<SystemTheme> entity)
    {
        entity.ToTable("system_themes");

        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        entity.Property(x => x.Code)
            .HasColumnName("code")
            .HasMaxLength(32)
            .IsRequired();

        entity.Property(x => x.Title)
            .HasColumnName("title")
            .HasMaxLength(64)
            .IsRequired();

        entity.Property(x => x.DominantColor)
            .HasColumnName("dominant_color")
            .HasMaxLength(16)
            .IsRequired();

        entity.Property(x => x.CssVariablesJson)
            .HasColumnName("css_variables_json")
            .HasColumnType("jsonb")
            .HasDefaultValue("{}")
            .IsRequired();

        entity.Property(x => x.IsDefault)
            .HasColumnName("is_default")
            .HasDefaultValue(false)
            .IsRequired();

        entity.Property(x => x.DisplayOrder)
            .HasColumnName("display_order")
            .IsRequired();

        entity.HasIndex(x => x.Code)
            .IsUnique()
            .HasDatabaseName("UX_SystemThemes_Code");

        entity.HasData(
            Create(
                SystemThemeIds.Sapphire,
                "sapphire",
                "Сапфировая",
                "#7b61ff",
                "{\"--color-bg\":\"#0b1020\",\"--color-text\":\"#e6e9f5\",\"--color-muted\":\"#a0a6c7\",\"--color-accent\":\"#7b61ff\"}",
                true,
                0),
            Create(
                SystemThemeIds.Ivory,
                "ivory",
                "Белая айвори",
                "#f4ead2",
                "{\"--color-bg\":\"#fbf6ea\",\"--color-text\":\"#2d261a\",\"--color-muted\":\"#786a54\",\"--color-accent\":\"#b68d4c\"}",
                false,
                1),
            Create(
                SystemThemeIds.Gray,
                "gray",
                "Серая",
                "#8f98a8",
                "{\"--color-bg\":\"#171a20\",\"--color-text\":\"#eef1f5\",\"--color-muted\":\"#aeb6c2\",\"--color-accent\":\"#8f98a8\"}",
                false,
                2),
            Create(
                SystemThemeIds.Sky,
                "sky",
                "Голубая",
                "#54b8ff",
                "{\"--color-bg\":\"#061725\",\"--color-text\":\"#e8f7ff\",\"--color-muted\":\"#99c7df\",\"--color-accent\":\"#54b8ff\"}",
                false,
                3),
            Create(
                SystemThemeIds.Black,
                "black",
                "Чёрная",
                "#101116",
                "{\"--color-bg\":\"#050507\",\"--color-text\":\"#f1f1f3\",\"--color-muted\":\"#a5a6ad\",\"--color-accent\":\"#f0f0f0\"}",
                false,
                4),
            Create(
                SystemThemeIds.Pink,
                "pink",
                "Розовая",
                "#ff77ba",
                "{\"--color-bg\":\"#25101d\",\"--color-text\":\"#fff0f7\",\"--color-muted\":\"#d6a2bd\",\"--color-accent\":\"#ff77ba\"}",
                false,
                5),
            Create(
                SystemThemeIds.GreenApple,
                "green-apple",
                "Зелёное яблоко",
                "#8ee957",
                "{\"--color-bg\":\"#0f2111\",\"--color-text\":\"#f2ffe9\",\"--color-muted\":\"#add09c\",\"--color-accent\":\"#8ee957\"}",
                false,
                6),
            Create(
                SystemThemeIds.Graphite,
                "graphite",
                "Графитовая",
                "#313131",
                "{\"--color-bg\":\"#121212\",\"--color-text\":\"#f2f2f2\",\"--color-muted\":\"#b8b8b8\",\"--color-accent\":\"#666666\"}",
                false,
                7),
            Create(
                SystemThemeIds.Snow,
                "snow",
                "Снежная",
                "#e4e7ec",
                "{\"--color-bg\":\"#f8fafc\",\"--color-text\":\"#1f2937\",\"--color-muted\":\"#5f6977\",\"--color-accent\":\"#647184\"}",
                false,
                8));
    }

    private static SystemTheme Create(
        Guid id,
        string code,
        string title,
        string dominantColor,
        string cssVariablesJson,
        bool isDefault,
        int displayOrder)
    {
        return new SystemTheme
        {
            Id = id,
            Code = code,
            Title = title,
            DominantColor = dominantColor,
            CssVariablesJson = cssVariablesJson,
            IsDefault = isDefault,
            DisplayOrder = displayOrder
        };
    }
}
