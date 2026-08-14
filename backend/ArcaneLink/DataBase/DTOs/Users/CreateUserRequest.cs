using System.ComponentModel.DataAnnotations;

namespace ArcaneLink.DataBase.DTOs.Users
{
    public class CreateUserRequest
    {
        [Required]
        [MinLength(3)]
        [MaxLength(50)]
        public string Login { get; set; } = null!;

        [Required]
        [MinLength(3)]
        [MaxLength(128)]
        public string DisplayName { get; set; } = null!;

        [Required]
        [EmailAddress]
        [MaxLength(254)]
        public string Email { get; set; } = null!;

        [Required]
        public string Password { get; set; } = null!;
    }
}
