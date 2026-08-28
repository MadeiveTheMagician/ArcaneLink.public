using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.SpacesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.SpacesConfigurations;

public class SpaceTypeConfiguration : IEntityTypeConfiguration<SpaceType>
{
    public void Configure(EntityTypeBuilder<SpaceType> entity)
    {
        entity.ToTable("space_types");

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

        entity.Property(x => x.Description)
            .HasColumnName("description")
            .HasMaxLength(255);

        entity.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        entity.HasIndex(x => x.Code)
            .IsUnique()
            .HasDatabaseName("UX_SpaceTypes_Code");

        var seededAt = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        entity.HasData(
            new SpaceType
            {
                Id = SpaceIds.TypeCategory,
                Code = "category",
                Title = "Category",
                Description = "Organizational container for server spaces.",
                CreatedAt = seededAt,
            },
            new SpaceType
            {
                Id = SpaceIds.TypeTextRoom,
                Code = "text_room",
                Title = "Text room",
                Description = "Text channel inside a server.",
                CreatedAt = seededAt,
            },
            new SpaceType
            {
                Id = SpaceIds.TypeVoiceRoom,
                Code = "voice_room",
                Title = "Voice room",
                Description = "Voice or video channel inside a server.",
                CreatedAt = seededAt,
            });
    }
}
