using System.Text.Json;
using ArcaneLink.DataBase.DTOs.Common;
using ArcaneLink.Exceptions;
using ArcaneLink.Exceptions.AssetExceptions.Abstractions;
using ArcaneLink.Exceptions.AuthExceptions;
using ArcaneLink.Exceptions.AuthExceptions.Abstractions;
using ArcaneLink.Exceptions.LoginExceptions.Abstractions;
using ArcaneLink.Exceptions.RequestExceptions.Abstractions;
using ArcaneLink.Exceptions.ServerExceptions.Abstractions;
using ArcaneLink.Exceptions.UserExceptions.Abstractions;
using ArcaneLink.Exceptions.UsersExceptions;
using ArcaneLink.Observability;

namespace ArcaneLink.Middleware;

public class ExceptionHandlingMiddleware
{
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        this._next = next;
        this._logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await this._next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            HandleRequestCanceled(context);
        }
        catch (Exception exception)
        {
            await this.HandleExceptionAsync(context, exception);
        }
    }

    private static void HandleRequestCanceled(HttpContext context)
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status499ClientClosedRequest;
        }
    }

    private async Task HandleExceptionAsync(
        HttpContext context,
        Exception exception)
    {
        var statusCode = GetStatusCode(exception);

        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            this._logger.LogError(
                ObservabilityEventIds.UnhandledException,
                exception,
                "Unhandled exception. TraceIdentifier={TraceIdentifier}",
                context.TraceIdentifier);
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var message = statusCode == StatusCodes.Status500InternalServerError
            ? ExceptionMessages.InternalServerError
            : exception.Message;

        var response = CreateErrorResponse(exception, message);
        var json = JsonSerializer.Serialize(response, JsonOptions);

        await context.Response.WriteAsync(json);
    }

    private static ErrorResponse CreateErrorResponse(
        Exception exception,
        string message)
    {
        if (exception is InvalidUserRegistrationDataException registrationException)
        {
            return new ErrorResponse(
                message,
                registrationException.Errors
                    .Select(error => new ErrorDetail(error.Code, error.Message))
                    .ToArray());
        }

        if (exception is EmailNotConfirmedException)
        {
            return new ErrorResponse(
                message,
                [new ErrorDetail("email_not_confirmed", message)]);
        }

        return new ErrorResponse(message);
    }

    private static int GetStatusCode(Exception exception)
    {
        return exception switch
        {
            LoginAlreadyExistsException => StatusCodes.Status409Conflict,
            EmailAlreadyExistsException => StatusCodes.Status409Conflict,
            UserWasBannedException => StatusCodes.Status403Forbidden,
            EmailNotConfirmedException => StatusCodes.Status403Forbidden,
            InvalidCurrentPasswordException => StatusCodes.Status400BadRequest,
            DirectMessagePrivacyDeniedException => StatusCodes.Status403Forbidden,
            LoginSystemException => StatusCodes.Status401Unauthorized,
            AuthSystemException => StatusCodes.Status401Unauthorized,
            AssetException => StatusCodes.Status400BadRequest,
            ServerException => StatusCodes.Status400BadRequest,
            UserException => StatusCodes.Status400BadRequest,
            RequestException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };
    }
}
