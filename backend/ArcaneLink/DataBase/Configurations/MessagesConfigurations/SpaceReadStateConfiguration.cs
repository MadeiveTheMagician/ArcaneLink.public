using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations
{
    public class SpaceReadStateConfiguration : IEntityTypeConfiguration<SpaceReadState>
    {
        public void Configure(EntityTypeBuilder<SpaceReadState> entity)
        {
            entity.ToTable("space_read_states");

            entity.HasKey(x => new { x.UserId, x.SpaceId });

            entity.Property(x => x.UserId)
                .HasColumnName("user_id")
                .ValueGeneratedNever();
            entity.Property(x => x.SpaceId)
                .HasColumnName("space_id")
                .ValueGeneratedNever();
            entity.Property(x => x.LastReadMessageId)
                .HasColumnName("last_read_message_id")
                .IsConcurrencyToken();
            entity.Property(x => x.LastReadMessageCreatedAt)
                .HasColumnName("last_read_message_created_at")
                .IsConcurrencyToken();
            entity.Property(x => x.ReadAt)
                .HasColumnName("read_at")
                .IsRequired();
            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasIndex(x => new { x.SpaceId, x.UserId })
                .HasDatabaseName("IX_SpaceReadStates_Space_User");
            entity.HasIndex(x => x.LastReadMessageId)
                .HasDatabaseName("IX_SpaceReadStates_LastMessage");

            entity.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Space)
                .WithMany()
                .HasForeignKey(x => x.SpaceId)
                .OnDelete(DeleteBehavior.Cascade);

        }
    }
}
