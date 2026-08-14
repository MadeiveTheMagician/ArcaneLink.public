using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class UserProfileTagConfiguration : IEntityTypeConfiguration<UserProfileTag>
    {
        public void Configure(EntityTypeBuilder<UserProfileTag> entity)
        {
            entity.ToTable("user_profile_tags");

            entity.HasKey(x => new { x.UserId, x.TagId });

            entity.Property(x => x.UserId)
                .HasColumnName("user_id");

            entity.Property(x => x.TagId)
                .HasColumnName("tag_id");

            entity.Property(x => x.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();

            entity.HasOne(x => x.Profile)
                .WithMany(x => x.Tags)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Tag)
                .WithMany(x => x.ProfileTags)
                .HasForeignKey(x => x.TagId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.TagId);
        }
    }
}
