using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.Services.Notifications.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    [Route("api/notifications")]
    public class NotificationsController : ControllerBase
    {
        private readonly IUserNotificationService _notifications;

        public NotificationsController(IUserNotificationService notifications)
        {
            _notifications = notifications;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<UserNotificationResponse>>> Get(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            return userId == null
                ? Unauthorized()
                : Ok(await _notifications.GetAsync(userId.Value, cancellationToken));
        }

        [HttpPost("{notificationId:guid}/read")]
        public async Task<IActionResult> MarkRead(
            Guid notificationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            return await _notifications.MarkReadAsync(
                userId.Value,
                notificationId,
                cancellationToken)
                ? NoContent()
                : NotFound();
        }

        [HttpPost("read-all")]
        public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            await _notifications.MarkAllReadAsync(userId.Value, cancellationToken);
            return NoContent();
        }

        [HttpDelete("history")]
        public async Task<IActionResult> ClearHistory(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            await _notifications.ClearHistoryAsync(userId.Value, cancellationToken);
            return NoContent();
        }

        private Guid? GetCurrentUserId()
        {
            var value = User.FindFirstValue("userId");
            return Guid.TryParse(value, out var userId) ? userId : null;
        }
    }
}
