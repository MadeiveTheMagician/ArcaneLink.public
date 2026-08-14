namespace ArcaneLink.Services.RequestInfo.Abstractions
{
    public interface IRequestInfoService
    {
        /// <summary>
        /// Получить IP-адрес клиента, отправившего запрос.
        /// </summary>
        /// <returns>IP-адрес клиента в виде строки.</returns>
        string GetClientIpAddress();
        /// <summary>
        /// Получить информацию о клиентском устройстве, отправившем запрос.
        /// </summary>
        /// <returns>Информация о клиентском устройстве в виде строки.</returns>
        string GetClientDeviceInfo();

        /// <summary>
        /// Получить User-Agent из заголовков запроса, который содержит информацию о браузере и операционной системе клиента.
        /// </summary>
        /// <returns>User-Agent клиента в виде строки.</returns>
        string GetUserAgent();

    }
}
