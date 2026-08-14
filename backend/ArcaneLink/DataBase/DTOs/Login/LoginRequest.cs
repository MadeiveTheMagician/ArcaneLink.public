using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Login
{
    // DTO запроса на вход в систему.
    //
    // Пользователь может вводить:
    // - login
    // - или email
    //
    // Поэтому поле называется LoginOrEmail.
    public class LoginRequest
    {
        [Required]
        [MinLength(3)]
        [MaxLength(254)]
        public string LoginOrEmail { get; set; } = null!;

        [Required]
        [MinLength(8)]
        [MaxLength(128)]
        public string Password { get; set; } = null!;

        [MaxLength(128)]
        public string? DeviceName { get; set; }
    }
}
