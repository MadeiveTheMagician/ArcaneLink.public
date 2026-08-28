using ArcaneLink.DataBase.Models.UsersModels;
using ArcaneLink.Services.Users.Abstractions;
using Microsoft.AspNetCore.Identity;

namespace ArcaneLink.Services.Users;

public class UserPasswordService : IUserPasswordService
{
    private static readonly User DummyUser = new()
    {
        Id = Guid.Empty,
        Login = "dummy",
        LoginNorm = "DUMMY",
        Email = "dummy@example.invalid",
        EmailNorm = "DUMMY@EXAMPLE.INVALID",
        PasswordHash = string.Empty,
        CreatedAt = DateTime.UnixEpoch
    };
    private static readonly string DummyPasswordHash =
        new PasswordHasher<User>().HashPassword(
            DummyUser,
            "ArcaneLink.Dummy.Password.NeverUsed!7");
    private readonly PasswordHasher<User> _passwordHasher = new();

    public string HashPassword(User user, string password)
    {
        return this._passwordHasher.HashPassword(user, password);
    }

    public void PerformDummyVerification(string password)
    {
        _ = this._passwordHasher.VerifyHashedPassword(
            DummyUser,
            DummyPasswordHash,
            password);
    }

    public PasswordVerificationResult VerifyPassword(
        User user,
        string passwordHash,
        string password)
    {
        return this._passwordHasher.VerifyHashedPassword(
            user,
            passwordHash,
            password);
    }
}
