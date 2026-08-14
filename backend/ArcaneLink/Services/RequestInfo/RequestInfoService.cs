using ArcaneLink.Exceptions.RequestExceptions;
using ArcaneLink.Services.RequestInfo.Abstractions;

namespace ArcaneLink.Services.Request
{
    // Сервис получения информации о текущем HTTP-запросе.
    //
    // Нужен для извлечения:
    // - IP адреса клиента;
    // - User-Agent;
    // - device info.
    //
    // Это позволяет не тащить HttpContext в бизнес-логику.
    public class RequestInfoService : IRequestInfoService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public RequestInfoService(
            IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        // Возвращает IP адрес клиента.
        public string GetClientIpAddress()
        {
            var currentIpAddress =
                _httpContextAccessor
                    .HttpContext?
                    .Connection
                    .RemoteIpAddress?
                    .ToString();

            if (string.IsNullOrWhiteSpace(currentIpAddress))
            {
                throw new IpAddressIsNullException();
            }

            return currentIpAddress;
        }

        // Возвращает User-Agent клиента.
        public string GetUserAgent()
        {
            var userAgent =
                _httpContextAccessor
                    .HttpContext?
                    .Request
                    .Headers["User-Agent"]
                    .ToString();

            if (string.IsNullOrWhiteSpace(userAgent))
            {
                throw new UserAgentIsNullException();
            }

            return userAgent;
        }

        // Возвращает сводную информацию об устройстве.
        //
        // User-Agent + IP.
        public string GetClientDeviceInfo()
        {
            var userAgent = GetUserAgent();
            var ipAddress = GetClientIpAddress();

            return $"{userAgent} | {ipAddress}";
        }
    }
}