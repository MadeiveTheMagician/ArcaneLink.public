using ArcaneLink.DataBase.DTOs.Auth;
using ArcaneLink.Services.Email;

namespace ArcaneLink.Services.Auth.Abstraction;

public interface IAccountLifecycleService
{
    Task QueueRegistrationVerificationAsync(Guid userId, CancellationToken cancellationToken = default);
    Task QueueVerificationResendAsync(string email, CancellationToken cancellationToken = default);
    Task<ConfirmEmailResponse> ConfirmEmailAsync(string token, CancellationToken cancellationToken = default);
    Task QueuePasswordResetAsync(string loginOrEmail, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default);
    Task<AccountChangeResponse> ChangeLoginAsync(Guid userId, ChangeLoginRequest request, CancellationToken cancellationToken = default);
    Task QueueEmailChangeAsync(Guid userId, ChangeEmailRequest request, CancellationToken cancellationToken = default);
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken cancellationToken = default);
    Task<OutboxEmail?> PrepareDeferredEmailAsync(string kind, string lookup, CancellationToken cancellationToken = default);
}
