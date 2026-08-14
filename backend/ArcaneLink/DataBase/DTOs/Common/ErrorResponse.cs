namespace ArcaneLink.DataBase.DTOs.Common
{
    public class ErrorResponse
    {
        public ErrorResponse(string message)
            : this(message, Array.Empty<ErrorDetail>())
        {
        }

        public ErrorResponse(
            string message,
            IReadOnlyList<ErrorDetail> errors)
        {
            Message = message;
            Errors = errors;
        }

        public string Message { get; set; }

        public IReadOnlyList<ErrorDetail> Errors { get; set; }
    }

    public class ErrorDetail
    {
        public ErrorDetail(string code, string message)
        {
            Code = code;
            Message = message;
        }

        public string Code { get; set; }

        public string Message { get; set; }
    }
}
