namespace ArcaneLink.Services.Retention
{
    public sealed class DataRetentionOptions
    {
        public const string SectionName = "DataRetention";

        public int InvalidInviteRetentionDays { get; set; } = 60;
        public int DeletedUserRetentionDays { get; set; } = 60;
        public int DeletedServerRetentionDays { get; set; } = 60;
        public int DeletedSpaceRetentionDays { get; set; } = 60;
        public int DeletedMessageRetentionDays { get; set; } = 60;
    }
}
