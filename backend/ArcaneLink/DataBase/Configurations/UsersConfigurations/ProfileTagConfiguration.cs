using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class ProfileTagConfiguration : IEntityTypeConfiguration<ProfileTag>
    {
        public void Configure(EntityTypeBuilder<ProfileTag> entity)
        {
            entity.ToTable("profile_tags");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasColumnName("id");

            entity.Property(x => x.Code)
                .HasColumnName("code")
                .HasMaxLength(48)
                .IsRequired();

            entity.Property(x => x.Title)
                .HasColumnName("title")
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.DisplayOrder)
                .HasColumnName("display_order")
                .IsRequired();

            entity.HasIndex(x => x.Code)
                .IsUnique();

            entity.HasData(
                new ProfileTag { Id = ProfileTagIds.Gaming, Code = "gaming", Title = "Игры", DisplayOrder = 10 },
                new ProfileTag { Id = ProfileTagIds.Art, Code = "art", Title = "Арт", DisplayOrder = 20 },
                new ProfileTag { Id = ProfileTagIds.Music, Code = "music", Title = "Музыка", DisplayOrder = 30 },
                new ProfileTag { Id = ProfileTagIds.Anime, Code = "anime", Title = "Аниме", DisplayOrder = 40 },
                new ProfileTag { Id = ProfileTagIds.Technology, Code = "technology", Title = "Технологии", DisplayOrder = 50 },
                new ProfileTag { Id = ProfileTagIds.Programming, Code = "programming", Title = "Программирование", DisplayOrder = 60 },
                new ProfileTag { Id = ProfileTagIds.Roleplay, Code = "roleplay", Title = "Ролевые", DisplayOrder = 70 },
                new ProfileTag { Id = ProfileTagIds.Movies, Code = "movies", Title = "Кино", DisplayOrder = 80 },
                new ProfileTag { Id = ProfileTagIds.Chill, Code = "chill", Title = "Спокойное общение", DisplayOrder = 90 },
                new ProfileTag { Id = ProfileTagIds.Education, Code = "education", Title = "Обучение", DisplayOrder = 100 });
        }
    }
}
