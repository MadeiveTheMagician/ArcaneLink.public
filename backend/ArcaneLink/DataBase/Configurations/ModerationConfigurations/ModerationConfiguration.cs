using ArcaneLink.DataBase.Models.ModerationModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ArcaneLink.DataBase.Configurations.ModerationConfigurations
{
    public sealed class ModerationCaseConfiguration : IEntityTypeConfiguration<ModerationCase>
    {
        public void Configure(EntityTypeBuilder<ModerationCase> entity)
        {
            entity.ToTable("moderation_cases", table => table.HasCheckConstraint(
                "CK_ModerationCases_Status",
                "\"status\" IN ('open', 'in_review', 'resolved', 'dismissed')"));
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.ServerId).HasColumnName("server_id").IsRequired();
            entity.Property(x => x.SpaceId).HasColumnName("space_id").IsRequired();
            entity.Property(x => x.MessageId).HasColumnName("message_id").IsRequired();
            entity.Property(x => x.ReportedUserId).HasColumnName("reported_user_id").IsRequired();
            entity.Property(x => x.Status).HasColumnName("status").HasMaxLength(16).IsRequired();
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
            entity.Property(x => x.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired()
                .IsConcurrencyToken();

            entity.HasIndex(x => x.MessageId)
                .IsUnique()
                .HasDatabaseName("UX_ModerationCases_Message");
            entity.HasIndex(x => new { x.ServerId, x.UpdatedAt, x.Id })
                .HasDatabaseName("IX_ModerationCases_Server_Cursor");
            entity.HasIndex(x => new { x.ReportedUserId, x.UpdatedAt })
                .HasDatabaseName("IX_ModerationCases_ReportedUser_Time");

            // Cases and their evidence are retention records. Do not let a hard
            // delete of live product data cascade into the moderation trail.
            entity.HasOne(x => x.Server).WithMany().HasForeignKey(x => x.ServerId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Space).WithMany().HasForeignKey(x => x.SpaceId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Message).WithMany().HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.ReportedUser).WithMany().HasForeignKey(x => x.ReportedUserId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    public sealed class ModerationSubmissionConfiguration : IEntityTypeConfiguration<ModerationSubmission>
    {
        public void Configure(EntityTypeBuilder<ModerationSubmission> entity)
        {
            entity.ToTable("moderation_submissions", table => table.HasCheckConstraint(
                "CK_ModerationSubmissions_Reason",
                "\"reason_code\" IN ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'privacy', 'other')"));
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.CaseId).HasColumnName("case_id").IsRequired();
            entity.Property(x => x.ReporterUserId).HasColumnName("reporter_user_id").IsRequired();
            entity.Property(x => x.ReasonCode).HasColumnName("reason_code").HasMaxLength(32).IsRequired();
            entity.Property(x => x.Details).HasColumnName("details").HasMaxLength(1000);
            entity.Property(x => x.SubmittedAt).HasColumnName("submitted_at").IsRequired();

            entity.HasIndex(x => new { x.CaseId, x.ReporterUserId })
                .IsUnique()
                .HasDatabaseName("UX_ModerationSubmissions_Case_Reporter");
            entity.HasIndex(x => new { x.ReporterUserId, x.SubmittedAt })
                .HasDatabaseName("IX_ModerationSubmissions_Reporter_Time");

            entity.HasOne(x => x.Case).WithMany(x => x.Submissions).HasForeignKey(x => x.CaseId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ReporterUser).WithMany().HasForeignKey(x => x.ReporterUserId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    public sealed class ModerationEvidenceConfiguration : IEntityTypeConfiguration<ModerationEvidence>
    {
        public void Configure(EntityTypeBuilder<ModerationEvidence> entity)
        {
            entity.ToTable("moderation_evidence");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.SubmissionId).HasColumnName("submission_id").IsRequired();
            entity.Property(x => x.BodyExcerpt).HasColumnName("body_excerpt").HasMaxLength(2000);
            entity.Property(x => x.PayloadExcerpt).HasColumnName("payload_excerpt").HasMaxLength(4000);
            entity.Property(x => x.CanonicalContentSha256).HasColumnName("canonical_content_sha256").HasMaxLength(64).IsFixedLength().IsRequired();
            entity.Property(x => x.MessageCreatedAt).HasColumnName("message_created_at").IsRequired();
            entity.Property(x => x.MessageUpdatedAt).HasColumnName("message_updated_at").IsRequired();
            entity.Property(x => x.MessageEditedAt).HasColumnName("message_edited_at");
            entity.Property(x => x.CapturedAt).HasColumnName("captured_at").IsRequired();

            entity.HasIndex(x => x.SubmissionId).IsUnique().HasDatabaseName("UX_ModerationEvidence_Submission");
            entity.HasOne(x => x.Submission).WithOne(x => x.Evidence).HasForeignKey<ModerationEvidence>(x => x.SubmissionId).OnDelete(DeleteBehavior.Cascade);
        }
    }

    public sealed class ModerationEvidenceAssetConfiguration : IEntityTypeConfiguration<ModerationEvidenceAsset>
    {
        public void Configure(EntityTypeBuilder<ModerationEvidenceAsset> entity)
        {
            entity.ToTable("moderation_evidence_assets");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.EvidenceId).HasColumnName("evidence_id").IsRequired();
            entity.Property(x => x.AssetId).HasColumnName("asset_id").IsRequired();
            entity.Property(x => x.DisplayOrder).HasColumnName("display_order").IsRequired();
            entity.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(255);
            entity.Property(x => x.IsSpoiler).HasColumnName("is_spoiler").IsRequired();
            entity.Property(x => x.OriginalFileName).HasColumnName("original_file_name").HasMaxLength(255);
            entity.Property(x => x.MimeType).HasColumnName("mime_type").HasMaxLength(100).IsRequired();
            entity.Property(x => x.SizeBytes).HasColumnName("size_bytes").IsRequired();
            entity.Property(x => x.Sha256).HasColumnName("sha256").HasMaxLength(64).IsFixedLength().IsRequired();
            entity.Property(x => x.Width).HasColumnName("width");
            entity.Property(x => x.Height).HasColumnName("height");
            entity.Property(x => x.AssetCreatedAt).HasColumnName("asset_created_at").IsRequired();

            entity.HasIndex(x => new { x.EvidenceId, x.AssetId }).IsUnique().HasDatabaseName("UX_ModerationEvidenceAssets_Evidence_Asset");
            entity.HasIndex(x => x.AssetId).HasDatabaseName("IX_ModerationEvidenceAssets_Asset");
            entity.HasOne(x => x.Evidence).WithMany(x => x.Assets).HasForeignKey(x => x.EvidenceId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Asset).WithMany().HasForeignKey(x => x.AssetId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    public sealed class ModerationCaseActionConfiguration : IEntityTypeConfiguration<ModerationCaseAction>
    {
        public void Configure(EntityTypeBuilder<ModerationCaseAction> entity)
        {
            entity.ToTable("moderation_case_actions", table =>
            {
                table.HasCheckConstraint("CK_ModerationCaseActions_FromStatus", "\"from_status\" IN ('open', 'in_review', 'resolved', 'dismissed')");
                table.HasCheckConstraint("CK_ModerationCaseActions_ToStatus", "\"to_status\" IN ('open', 'in_review', 'resolved', 'dismissed')");
            });
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(x => x.CaseId).HasColumnName("case_id").IsRequired();
            entity.Property(x => x.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(x => x.FromStatus).HasColumnName("from_status").HasMaxLength(16).IsRequired();
            entity.Property(x => x.ToStatus).HasColumnName("to_status").HasMaxLength(16).IsRequired();
            entity.Property(x => x.Note).HasColumnName("note").HasMaxLength(1000);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();

            entity.HasIndex(x => new { x.CaseId, x.CreatedAt, x.Id }).HasDatabaseName("IX_ModerationCaseActions_Case_Time");
            entity.HasOne(x => x.Case).WithMany(x => x.Actions).HasForeignKey(x => x.CaseId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ActorUser).WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
        }
    }
}
