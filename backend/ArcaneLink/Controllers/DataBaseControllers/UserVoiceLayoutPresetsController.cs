using System.Security.Claims;
using ArcaneLink.DataBase._Data;
using ArcaneLink.DataBase.DTOs.Users;
using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArcaneLink.Controllers.DataBaseControllers
{
    [ApiController]
    [Authorize]
    [Route("api/users/me/voice-layout-presets")]
    public class UserVoiceLayoutPresetsController : ControllerBase
    {
        private readonly AppDbContext _dbContext;

        public UserVoiceLayoutPresetsController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<VoiceLayoutPresetResponse>>> GetPresets(
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var presets = await _dbContext.UserVoiceLayoutPresets
                .AsNoTracking()
                .Include(x => x.Slots)
                .Where(x => x.UserId == userId.Value)
                .OrderBy(x => x.Name)
                .ToListAsync(cancellationToken);

            return Ok(presets.Select(MapPreset).ToList());
        }

        [HttpPost]
        public async Task<ActionResult<VoiceLayoutPresetResponse>> CreatePreset(
            [FromBody] VoiceLayoutPresetRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var validationError = ValidatePreset(request);
            if (validationError != null)
            {
                return BadRequest(validationError);
            }

            var now = DateTime.UtcNow;
            var preset = new UserVoiceLayoutPreset
            {
                Id = request.Id ?? Guid.NewGuid(),
                UserId = userId.Value,
                Name = request.Name.Trim(),
                IsPinned = request.IsPinned,
                ShowParticipantsWithoutVideo = request.ShowParticipantsWithoutVideo,
                HideServiceInfo = request.HideServiceInfo,
                GridColumns = request.GridColumns,
                GridRows = request.GridRows,
                CellSizePx = request.CellSizePx,
                CreatedAt = now,
                UpdatedAt = now,
                Slots = request.Slots
                    .OrderBy(x => x.Index)
                    .Select(slot => MapSlot(slot, request.Id ?? Guid.Empty))
                    .ToList(),
            };

            foreach (var slot in preset.Slots)
            {
                slot.PresetId = preset.Id;
            }

            _dbContext.UserVoiceLayoutPresets.Add(preset);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return CreatedAtAction(
                nameof(GetPresets),
                new { id = preset.Id },
                MapPreset(preset));
        }

        [HttpPut("{presetId:guid}")]
        public async Task<ActionResult<VoiceLayoutPresetResponse>> UpdatePreset(
            Guid presetId,
            [FromBody] VoiceLayoutPresetRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var validationError = ValidatePreset(request);
            if (validationError != null)
            {
                return BadRequest(validationError);
            }

            var preset = await _dbContext.UserVoiceLayoutPresets
                .FirstOrDefaultAsync(
                    x => x.Id == presetId && x.UserId == userId.Value,
                    cancellationToken);

            if (preset == null)
            {
                return NotFound();
            }

            preset.Name = request.Name.Trim();
            preset.IsPinned = request.IsPinned;
            preset.ShowParticipantsWithoutVideo = request.ShowParticipantsWithoutVideo;
            preset.HideServiceInfo = request.HideServiceInfo;
            preset.GridColumns = request.GridColumns;
            preset.GridRows = request.GridRows;
            preset.CellSizePx = request.CellSizePx;
            preset.UpdatedAt = DateTime.UtcNow;

            var slots = request.Slots
                .OrderBy(x => x.Index)
                .Select(slot => MapSlot(slot, preset.Id))
                .ToList();

            await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

            await _dbContext.UserVoiceLayoutPresetSlots
                .Where(slot => slot.PresetId == preset.Id)
                .ExecuteDeleteAsync(cancellationToken);

            _dbContext.UserVoiceLayoutPresetSlots.AddRange(slots);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            preset.Slots = slots;

            return Ok(MapPreset(preset));
        }

        [HttpDelete("{presetId:guid}")]
        public async Task<IActionResult> DeletePreset(
            Guid presetId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized();
            }

            var preset = await _dbContext.UserVoiceLayoutPresets
                .FirstOrDefaultAsync(
                    x => x.Id == presetId && x.UserId == userId.Value,
                    cancellationToken);

            if (preset == null)
            {
                return NotFound();
            }

            _dbContext.UserVoiceLayoutPresets.Remove(preset);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return NoContent();
        }

        private static string? ValidatePreset(VoiceLayoutPresetRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 96)
            {
                return "Preset name must be between 1 and 96 characters.";
            }

            if (request.GridColumns is < 2 or > 120 ||
                request.GridRows is < 2 or > 54 ||
                request.CellSizePx is < 6 or > 32)
            {
                return "Preset grid dimensions are out of range.";
            }

            if (request.Slots.Count is < 1 or > 64)
            {
                return "Preset must contain between 1 and 64 slots.";
            }

            if (request.Slots.Select(x => x.Index).Distinct().Count() != request.Slots.Count)
            {
                return "Preset slot indexes must be unique.";
            }

            if (request.Slots.Any(slot =>
                    slot.Index < 1 ||
                    slot.Width <= 0 ||
                    slot.Height <= 0 ||
                    slot.X < 0 ||
                    slot.Y < 0 ||
                    slot.BorderRadius is < 0 or > 360 ||
                    slot.X + slot.Width > request.GridColumns ||
                    slot.Y + slot.Height > request.GridRows ||
                    slot.Mode is not ("grid" or "free") ||
                    slot.AspectRatio is not ("16:9" or "21:9" or "4:3" or "free")))
            {
                return "Preset slot geometry is invalid.";
            }

            return null;
        }

        private static UserVoiceLayoutPresetSlot MapSlot(
            VoiceLayoutPresetSlotRequest request,
            Guid? presetId = null)
        {
            return new UserVoiceLayoutPresetSlot
            {
                Id = Guid.NewGuid(),
                PresetId = presetId ?? Guid.Empty,
                SlotIndex = request.Index,
                PreserveAspectRatio = request.PreserveAspectRatio,
                X = request.X,
                Y = request.Y,
                Width = request.Width,
                Height = request.Height,
                BorderRadius = request.BorderRadius,
                ZIndex = request.ZIndex,
                Mode = request.Mode,
                AspectRatio = string.IsNullOrWhiteSpace(request.AspectRatio)
                    ? "16:9"
                    : request.AspectRatio,
            };
        }

        private static VoiceLayoutPresetResponse MapPreset(UserVoiceLayoutPreset preset)
        {
            return new VoiceLayoutPresetResponse
            {
                Id = preset.Id,
                Name = preset.Name,
                IsPinned = preset.IsPinned,
                ShowParticipantsWithoutVideo = preset.ShowParticipantsWithoutVideo,
                HideServiceInfo = preset.HideServiceInfo,
                GridColumns = preset.GridColumns,
                GridRows = preset.GridRows,
                CellSizePx = preset.CellSizePx,
                CreatedAt = preset.CreatedAt,
                UpdatedAt = preset.UpdatedAt,
                Slots = preset.Slots
                    .OrderBy(x => x.SlotIndex)
                    .Select(slot => new VoiceLayoutPresetSlotResponse
                    {
                        Id = slot.Id,
                        Index = slot.SlotIndex,
                        PreserveAspectRatio = slot.PreserveAspectRatio,
                        X = slot.X,
                        Y = slot.Y,
                        Width = slot.Width,
                        Height = slot.Height,
                        BorderRadius = slot.BorderRadius,
                        ZIndex = slot.ZIndex,
                        Mode = slot.Mode,
                        AspectRatio = slot.AspectRatio,
                    })
                    .ToList(),
            };
        }

        private Guid? GetCurrentUserId()
        {
            var userIdValue = User.FindFirstValue("userId");

            return Guid.TryParse(userIdValue, out var userId)
                ? userId
                : null;
        }
    }
}
