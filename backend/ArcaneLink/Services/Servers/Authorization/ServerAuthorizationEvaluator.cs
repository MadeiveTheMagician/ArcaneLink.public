namespace ArcaneLink.Services.Servers.Authorization
{
    public static class ServerAuthorizationEvaluator
    {
        public static bool IsAllowed(
            ServerAuthorizationPrincipal principal,
            ServerAuthorizationRequest request)
        {
            ArgumentNullException.ThrowIfNull(principal);
            ArgumentNullException.ThrowIfNull(request);

            if (!principal.IsActiveMember ||
                principal.ServerId == Guid.Empty ||
                principal.ServerId != request.ServerId ||
                !TryResolvePrincipal(
                    principal,
                    out var actorAuthority,
                    out var isAdministrator) ||
                !TryResolvePermissionBits(
                    request,
                    out var permissionBit,
                    out var dependencyBits) ||
                !IsValidResource(request.PermissionResource, request.ServerId) ||
                !IsValidTarget(request.Target, request.ServerId))
            {
                return false;
            }

            // Owner-only restrictions must be enforced before either privileged bypass.
            if (request.OwnerOnly && !principal.IsOwner)
            {
                return false;
            }

            var permissionAllowed = principal.IsOwner || isAdministrator;
            if (permissionBit == ServerPermissionRegistry.Administrator.Bit &&
                !permissionAllowed)
            {
                return false;
            }

            if (!permissionAllowed)
            {
                var effectiveMask = CreateBaseMask(principal);
                if (request.PermissionResource is not null)
                {
                    effectiveMask = ApplyOverrides(
                        effectiveMask,
                        principal,
                        request.PermissionResource);
                }

                permissionAllowed = effectiveMask.Contains(permissionBit) &&
                                    dependencyBits.All(effectiveMask.Contains);
            }

            return permissionAllowed &&
                   SatisfiesHierarchy(actorAuthority, request.Target);
        }

        public static bool TryResolvePrincipal(
            ServerAuthorizationPrincipal principal,
            out ServerRoleAuthority authority,
            out bool isAdministrator)
        {
            ArgumentNullException.ThrowIfNull(principal);

            authority = default;
            isAdministrator = false;
            if (!principal.IsActiveMember ||
                principal.ServerId == Guid.Empty ||
                principal.MemberId == Guid.Empty ||
                !IsValidRole(principal.EveryoneRole, principal.ServerId) ||
                principal.EveryoneRole.Kind != ServerAuthorizationRoleKind.Everyone ||
                principal.AssignedRoles is null)
            {
                return false;
            }

            var roleIds = new HashSet<Guid> { principal.EveryoneRole.Id };
            foreach (var role in principal.AssignedRoles)
            {
                if (!IsValidRole(role, principal.ServerId) ||
                    role.Kind == ServerAuthorizationRoleKind.Everyone ||
                    !roleIds.Add(role.Id))
                {
                    return false;
                }
            }

            if (principal.IsOwner)
            {
                authority = ServerRoleAuthority.Owner(principal.ServerId);
                return true;
            }

            var administratorBit = ServerPermissionRegistry.Administrator.Bit;
            var administratorPosition = principal.AssignedRoles
                .Where(role =>
                    role.Kind == ServerAuthorizationRoleKind.Standard &&
                    role.PermissionMask.Contains(administratorBit))
                .Select(role => (int?)role.Position)
                .Min();
            if (administratorPosition.HasValue)
            {
                isAdministrator = true;
                authority = ServerRoleAuthority.Administrator(
                    principal.ServerId,
                    administratorPosition.Value);
                return true;
            }

            var standardPosition = principal.AssignedRoles
                .Select(role => (int?)role.Position)
                .Min();
            authority = standardPosition.HasValue
                ? ServerRoleAuthority.Standard(
                    principal.ServerId,
                    standardPosition.Value)
                : ServerRoleAuthority.Everyone(principal.ServerId);
            return true;
        }

        private static bool TryResolvePermissionBits(
            ServerAuthorizationRequest request,
            out int permissionBit,
            out IReadOnlyList<int> dependencyBits)
        {
            permissionBit = 0;
            dependencyBits = [];
            if (request.DependencyCodes is null ||
                !ServerPermissionRegistry.TryGet(
                    request.PermissionCode,
                    out var permission))
            {
                return false;
            }

            var resolved = new List<int>(request.DependencyCodes.Count);
            foreach (var dependencyCode in request.DependencyCodes)
            {
                if (!ServerPermissionRegistry.TryGet(
                        dependencyCode,
                        out var dependency))
                {
                    return false;
                }

                resolved.Add(dependency.Bit);
            }

            permissionBit = permission.Bit;
            dependencyBits = resolved;
            return true;
        }

        private static PermissionMask256 CreateBaseMask(
            ServerAuthorizationPrincipal principal)
        {
            var administratorBit = ServerPermissionRegistry.Administrator.Bit;
            var effectiveMask = principal.EveryoneRole.PermissionMask
                .Without(administratorBit);

            foreach (var role in principal.AssignedRoles)
            {
                var roleMask = role.Kind == ServerAuthorizationRoleKind.Standard
                    ? role.PermissionMask
                    : role.PermissionMask.Without(administratorBit);
                effectiveMask |= roleMask;
            }

            return effectiveMask;
        }

        private static PermissionMask256 ApplyOverrides(
            PermissionMask256 baseMask,
            ServerAuthorizationPrincipal principal,
            ServerPermissionResource resource)
        {
            var scopes = resource.Space is null
                ? resource.CategoryPath
                : [.. resource.CategoryPath, resource.Space];
            var roleIds = principal.AssignedRoles
                .Select(role => role.Id)
                .Append(principal.EveryoneRole.Id)
                .ToHashSet();

            var applicableOverrides = scopes
                .SelectMany(scope => scope.Overrides)
                .Where(entry =>
                    entry.TargetKind == ServerPermissionOverrideTargetKind.Role
                        ? roleIds.Contains(entry.TargetId)
                        : entry.TargetId == principal.MemberId)
                .ToList();
            var authorities = applicableOverrides
                .Select(entry => ResolveProtectionAuthority(
                    entry,
                    principal.ServerId))
                .Distinct()
                .ToList();
            authorities.Sort(CompareAuthorities);

            var effectiveMask = baseMask;
            foreach (var authority in authorities)
            {
                // Preserve the established equal-authority semantics: role
                // overrides are evaluated root-to-leaf before member overrides.
                // Authority is the outer dimension so a lower manager cannot
                // neutralize policy protected by a higher role.
                foreach (var scope in scopes)
                {
                    effectiveMask = ApplyScope(
                        effectiveMask,
                        scope.Overrides.Where(entry =>
                            entry.TargetKind ==
                                ServerPermissionOverrideTargetKind.Role &&
                            roleIds.Contains(entry.TargetId) &&
                            ResolveProtectionAuthority(
                                entry,
                                principal.ServerId) == authority));
                }

                foreach (var scope in scopes)
                {
                    effectiveMask = ApplyScope(
                        effectiveMask,
                        scope.Overrides.Where(entry =>
                            entry.TargetKind ==
                                ServerPermissionOverrideTargetKind.Member &&
                            entry.TargetId == principal.MemberId &&
                            ResolveProtectionAuthority(
                                entry,
                                principal.ServerId) == authority));
                }
            }

            return effectiveMask;
        }

        private static ServerRoleAuthority ResolveProtectionAuthority(
            ServerPermissionOverride permissionOverride,
            Guid serverId)
        {
            // Rows created before protection metadata existed remain valid and
            // keep their relative legacy ordering, but cannot be defeated by a
            // newly-created lower-authority rule.
            return permissionOverride.ProtectionAuthority ??
                   ServerRoleAuthority.Owner(serverId);
        }

        private static int CompareAuthorities(
            ServerRoleAuthority left,
            ServerRoleAuthority right)
        {
            return ServerRoleAuthorityComparer.TryCompare(
                left,
                right,
                out var comparison)
                ? comparison
                : 0;
        }

        private static PermissionMask256 ApplyScope(
            PermissionMask256 inheritedMask,
            IEnumerable<ServerPermissionOverride> overrides)
        {
            var allowMask = PermissionMask256.Empty;
            var denyMask = PermissionMask256.Empty;
            foreach (var entry in overrides)
            {
                allowMask |= entry.AllowMask;
                denyMask |= entry.DenyMask;
            }

            return (inheritedMask | allowMask).Except(denyMask);
        }

        private static bool IsValidResource(
            ServerPermissionResource? resource,
            Guid serverId)
        {
            if (resource is null)
            {
                return true;
            }

            if (resource.ServerId != serverId ||
                resource.CategoryPath is null)
            {
                return false;
            }

            var scopes = resource.Space is null
                ? resource.CategoryPath
                : [.. resource.CategoryPath, resource.Space];
            var resourceIds = new HashSet<Guid>();
            return scopes.All(scope =>
                scope is not null &&
                resourceIds.Add(scope.ResourceId) &&
                IsValidScope(scope, serverId));
        }

        private static bool IsValidScope(
            ServerPermissionScope scope,
            Guid serverId)
        {
            if (scope.ServerId != serverId ||
                scope.ResourceId == Guid.Empty ||
                scope.Overrides is null)
            {
                return false;
            }

            foreach (var entry in scope.Overrides)
            {
                if (entry is null ||
                    entry.ServerId != serverId ||
                    entry.TargetServerId != serverId ||
                    entry.TargetId == Guid.Empty ||
                    !Enum.IsDefined(entry.TargetKind) ||
                    !IsKnownMask(entry.AllowMask) ||
                    !IsKnownMask(entry.DenyMask) ||
                    (entry.ProtectionAuthority.HasValue &&
                     !ServerRoleAuthorityComparer.TryCompare(
                         entry.ProtectionAuthority.Value,
                         entry.ProtectionAuthority.Value,
                         out _)) ||
                    entry.AllowMask.Contains(
                        ServerPermissionRegistry.Administrator.Bit) ||
                    entry.DenyMask.Contains(
                        ServerPermissionRegistry.Administrator.Bit))
                {
                    return false;
                }
            }

            return true;
        }

        private static bool IsValidTarget(
            ServerAuthorizationTarget? target,
            Guid serverId)
        {
            return target switch
            {
                null => true,
                ServerAuthorizationResourceTarget resource =>
                    IsValidRole(resource.ProtectionRole, serverId),
                ServerAuthorizationAuthorityTarget authority =>
                    authority.ProtectionAuthority.ServerId == serverId &&
                    ServerRoleAuthorityComparer.TryCompare(
                        authority.ProtectionAuthority,
                        authority.ProtectionAuthority,
                        out _),
                ServerAuthorizationSubjectTarget subject =>
                    subject.Subject is not null &&
                    subject.Subject.ServerId == serverId &&
                    TryResolvePrincipal(subject.Subject, out _, out _),
                _ => false
            };
        }

        private static bool SatisfiesHierarchy(
            ServerRoleAuthority actor,
            ServerAuthorizationTarget? target)
        {
            return target switch
            {
                null => true,
                ServerAuthorizationResourceTarget resource =>
                    TryResolveRoleAuthority(
                        resource.ProtectionRole,
                        out var protection) &&
                    ServerRoleAuthorityComparer.CanManageResource(actor, protection),
                ServerAuthorizationAuthorityTarget authority =>
                    ServerRoleAuthorityComparer.CanManageResource(
                        actor,
                        authority.ProtectionAuthority),
                ServerAuthorizationSubjectTarget subject =>
                    TryResolvePrincipal(subject.Subject, out var targetAuthority, out _) &&
                    ServerRoleAuthorityComparer.CanAffectSubject(actor, targetAuthority),
                _ => false
            };
        }

        public static bool TryResolveRoleAuthority(
            ServerAuthorizationRole role,
            out ServerRoleAuthority authority)
        {
            authority = default;
            if (!IsValidRole(role, role.ServerId))
            {
                return false;
            }

            authority = role.Kind switch
            {
                ServerAuthorizationRoleKind.Everyone =>
                    ServerRoleAuthority.Everyone(role.ServerId),
                ServerAuthorizationRoleKind.Standard
                    when role.PermissionMask.Contains(
                        ServerPermissionRegistry.Administrator.Bit) =>
                    ServerRoleAuthority.Administrator(role.ServerId, role.Position),
                _ => ServerRoleAuthority.Standard(role.ServerId, role.Position)
            };
            return true;
        }

        private static bool IsValidRole(
            ServerAuthorizationRole? role,
            Guid serverId)
        {
            if (role is null ||
                role.Id == Guid.Empty ||
                role.ServerId != serverId ||
                role.Position < 0 ||
                !Enum.IsDefined(role.Kind) ||
                !IsKnownMask(role.PermissionMask))
            {
                return false;
            }

            return role.Kind == ServerAuthorizationRoleKind.Standard ||
                   !role.PermissionMask.Contains(
                       ServerPermissionRegistry.Administrator.Bit);
        }

        private static bool IsKnownMask(PermissionMask256 mask)
        {
            return mask.Except(
                    ServerPermissionRegistry.KnownPermissionsMask)
                .IsEmpty;
        }
    }
}
