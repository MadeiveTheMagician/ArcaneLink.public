namespace ArcaneLink.DataBase.Constants
{
    public static class ServerGovernanceIds
    {
        public static readonly Guid InviteKindLink = Guid.Parse("24000000-0000-0000-0000-000000000001");
        public static readonly Guid InviteKindDirect = Guid.Parse("24000000-0000-0000-0000-000000000002");

        public static readonly Guid OwnershipTransferVoluntary = Guid.Parse("24000000-0000-0000-0000-000000000101");
        public static readonly Guid OwnershipTransferForced = Guid.Parse("24000000-0000-0000-0000-000000000102");
        public static readonly Guid OwnershipTransferRecovery = Guid.Parse("24000000-0000-0000-0000-000000000103");

        public static readonly Guid PermissionManageServer = Guid.Parse("24000000-0000-0000-0000-000000000201");
        public static readonly Guid PermissionManageRoles = Guid.Parse("24000000-0000-0000-0000-000000000202");
        public static readonly Guid PermissionManageInvites = Guid.Parse("24000000-0000-0000-0000-000000000203");
        public static readonly Guid PermissionManageMembers = Guid.Parse("24000000-0000-0000-0000-000000000204");
        public static readonly Guid PermissionViewAuditLog = Guid.Parse("24000000-0000-0000-0000-000000000205");
        public static readonly Guid PermissionManageReports = Guid.Parse("24000000-0000-0000-0000-000000000210");

        public static IReadOnlyList<Guid> ServerPermissionIds { get; } = Array.AsReadOnly(
        [
            PermissionManageServer,
            PermissionManageRoles,
            PermissionManageInvites,
            PermissionManageMembers,
            PermissionViewAuditLog,
            PermissionManageReports
        ]);

        public static readonly Guid AuditMemberJoined = Guid.Parse("24000000-0000-0000-0000-000000000301");
        public static readonly Guid AuditMemberLeft = Guid.Parse("24000000-0000-0000-0000-000000000302");
        public static readonly Guid AuditMemberRemoved = Guid.Parse("24000000-0000-0000-0000-000000000303");
        public static readonly Guid AuditOwnershipTransferred = Guid.Parse("24000000-0000-0000-0000-000000000304");
        public static readonly Guid AuditInviteCreated = Guid.Parse("24000000-0000-0000-0000-000000000305");
        public static readonly Guid AuditInviteRevoked = Guid.Parse("24000000-0000-0000-0000-000000000306");
        public static readonly Guid AuditRoleCreated = Guid.Parse("24000000-0000-0000-0000-000000000307");
        public static readonly Guid AuditRoleUpdated = Guid.Parse("24000000-0000-0000-0000-000000000308");
        public static readonly Guid AuditRoleAssigned = Guid.Parse("24000000-0000-0000-0000-000000000309");
        public static readonly Guid AuditRoleRevoked = Guid.Parse("24000000-0000-0000-0000-000000000310");
        public static readonly Guid AuditSpaceCreated = Guid.Parse("24000000-0000-0000-0000-000000000311");
        public static readonly Guid AuditSpaceUpdated = Guid.Parse("24000000-0000-0000-0000-000000000312");
        public static readonly Guid AuditSpaceDeleted = Guid.Parse("24000000-0000-0000-0000-000000000313");
        public static readonly Guid AuditSpacesReordered = Guid.Parse("24000000-0000-0000-0000-000000000314");
        public static readonly Guid AuditSpaceOverrideUpserted = Guid.Parse("24000000-0000-0000-0000-000000000315");
        public static readonly Guid AuditSpaceOverrideDeleted = Guid.Parse("24000000-0000-0000-0000-000000000316");
        public static readonly Guid AuditMemberBanned = Guid.Parse("24000000-0000-0000-0000-000000000317");
        public static readonly Guid AuditMemberUnbanned = Guid.Parse("24000000-0000-0000-0000-000000000318");
    }
}
