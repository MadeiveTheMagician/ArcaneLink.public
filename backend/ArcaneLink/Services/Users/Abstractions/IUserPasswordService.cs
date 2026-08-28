using ArcaneLink.DataBase.Models.UsersModels;
using Microsoft.AspNetCore.Identity;

namespace ArcaneLink.Services.Users.Abstractions;

public interface IUserPasswordService
{
    string HashPassword(User user, string password);

    PasswordVerificationResult VerifyPassword(
        User user,
        string passwordHash,
        string password);

    void PerformDummyVerification(string password);
}
