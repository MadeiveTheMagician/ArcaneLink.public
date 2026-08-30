using System.Security.Claims;
using ArcaneLink.DataBase.DTOs.Notifications;
using ArcaneLink.Services.Notifications.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ArcaneLink.Controllers.DataBaseControllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly IUserNotificationService _notifications;

    public NotificationsController(IUserNotificationService notifications)
    {
        this._notifications = notifications;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserNotificationResponse>>> Get(
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        return userId == null
            ? this.Unauthorized()
            : this.Ok(await this._notifications.GetAsync(userId.Value, cancellationToken));
    }

    [HttpPost("{notificationId:guid}/read")]
    public async Task<IActionResult> MarkRead(
        Guid notificationId,
        CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        return await this._notifications.MarkReadAsync(
            userId.Value,
            notificationId,
            cancellationToken)
            ? this.NoContent()
            : this.NotFound();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        await this._notifications.MarkAllReadAsync(userId.Value, cancellationToken);
        return this.NoContent();
    }

    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory(CancellationToken cancellationToken)
    {
        var userId = this.GetCurrentUserId();
        if (userId == null)
        {
            return this.Unauthorized();
        }

        await this._notifications.ClearHistoryAsync(userId.Value, cancellationToken);
        return this.NoContent();
    }

    private Guid? GetCurrentUserId()
    {
        var value = this.User.FindFirstValue("userId");
        return Guid.TryParse(value, out var userId) ? userId : null;
    }
}
