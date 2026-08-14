using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.UsersConfigurations
{
    public class SubscriptionTypeConfiguration : IEntityTypeConfiguration<SubscriptionType>
    {
        public void Configure(EntityTypeBuilder<SubscriptionType> entity)
        {
            entity.ToTable("subscription_types");

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

            entity.Property(x => x.Rank)
                .HasColumnName("rank")
                .IsRequired();

            entity.HasIndex(x => x.Code)
                .IsUnique()
                .HasDatabaseName("UX_SubscriptionTypes_Code");

            entity.HasData(
                new SubscriptionType
                {
                    Id = SubscriptionTypeIds.Free,
                    Code = "free",
                    Title = "Free",
                    Rank = 0
                },
                new SubscriptionType
                {
                    Id = SubscriptionTypeIds.Plus,
                    Code = "plus",
                    Title = "Plus",
                    Rank = 10
                },
                new SubscriptionType
                {
                    Id = SubscriptionTypeIds.Prime,
                    Code = "prime",
                    Title = "Prime",
                    Rank = 20
                });
        }
    }
}
