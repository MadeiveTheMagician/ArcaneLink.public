using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations;

public class SpaceMessageUserDeletionConfiguration : IEntityTypeConfiguration<SpaceMessageUserDeletion>
{
    public void Configure(EntityTypeBuilder<SpaceMessageUserDeletion> entity)
    {
        entity.ToTable("space_message_user_deletions");

        entity.HasKey(x => new { x.MessageId, x.UserId });

        entity.Property(x => x.MessageId).HasColumnName("message_id").IsRequired();
        entity.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.DeletedAt).HasColumnName("deleted_at").IsRequired();
        entity.Property(x => x.RestoreUntil).HasColumnName("restore_until").IsRequired();

        entity.HasIndex(x => new { x.UserId, x.RestoreUntil })
            .HasDatabaseName("IX_SpaceMessageUserDeletions_User_RestoreUntil");
        entity.HasIndex(x => new { x.UserId, x.DeletedAt, x.MessageId })
            .HasDatabaseName("IX_SpaceMessageUserDeletions_User_DeletedAt_Message");

        entity.HasOne(x => x.Message)
            .WithMany(x => x.UserDeletions)
            .HasForeignKey(x => x.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne<ArcaneLink.DataBase.Models.UsersModels.User>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
