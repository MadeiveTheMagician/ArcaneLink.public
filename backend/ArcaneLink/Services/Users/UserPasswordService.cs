using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.AspNetCore.Identity;

namespace ArcaneLink.Services.Users
{
    public class UserPasswordService : IUserPasswordService
    {
        private readonly PasswordHasher<User> _passwordHasher = new();

        public string HashPassword(User user, string password)
        {
            return _passwordHasher.HashPassword(user, password);
        }

        public PasswordVerificationResult VerifyPassword(
            User user,
            string passwordHash,
            string password)
        {
            return _passwordHasher.VerifyHashedPassword(
                user,
                passwordHash,
                password);
        }
    }
}