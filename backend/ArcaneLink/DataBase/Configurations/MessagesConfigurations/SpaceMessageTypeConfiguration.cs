using ArcaneLink.DataBase.Constants;
using ArcaneLink.DataBase.Models.MessagesModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.MessagesConfigurations;

public class SpaceMessageTypeConfiguration : IEntityTypeConfiguration<SpaceMessageType>
{
    public void Configure(EntityTypeBuilder<SpaceMessageType> entity)
    {
        entity.ToTable("space_message_types");

        entity.HasKey(x => x.Id);
        entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(32).IsRequired();
        entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(64).IsRequired();
        entity.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UX_SpaceMessageTypes_Code");

        entity.HasData(
            new SpaceMessageType { Id = SpaceIds.MessageTypeText, Code = "text", Title = "Text" },
            new SpaceMessageType { Id = SpaceIds.MessageTypeSystem, Code = "system", Title = "System" },
            new SpaceMessageType { Id = SpaceIds.MessageTypeMedia, Code = "media", Title = "Media" },
            new SpaceMessageType { Id = SpaceIds.MessageTypeEvent, Code = "event", Title = "Event" });
    }
}
