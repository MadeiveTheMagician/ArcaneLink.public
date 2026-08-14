using ArcaneLink.DataBase.DTOs.Streaming;
using ArcaneLink.Services.Streaming;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace ArcaneLink.Controllers
{
    [ApiController]
    [Route("api/streaming")]
    public sealed class StreamingController : ControllerBase
    {
        private readonly StreamingOptions _options;

        public StreamingController(IOptions<StreamingOptions> options)
        {
            _options = options.Value;
        }

        [HttpGet("config")]
        public ActionResult<StreamingConfigResponse> GetConfig()
        {
            return Ok(new StreamingConfigResponse
            {
                MaxBitrateByResolution = _options.MaxBitrateByResolution
            });
        }
    }
}
