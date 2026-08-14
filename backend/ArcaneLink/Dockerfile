FROM mcr.microsoft.com/dotnet/sdk:10.0.300 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# The image is built from the repository root so that the pinned tool manifest
# and all backend projects are available in a clean clone.
COPY ["backend/ArcaneLink/ArcaneLink.csproj", "backend/ArcaneLink/"]
RUN dotnet restore "backend/ArcaneLink/ArcaneLink.csproj"
COPY ["backend/", "backend/"]

WORKDIR /src/backend/ArcaneLink
RUN dotnet build "ArcaneLink.csproj" \
    --configuration "$BUILD_CONFIGURATION" \
    --no-restore

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "ArcaneLink.csproj" \
    --configuration "$BUILD_CONFIGURATION" \
    --no-build \
    --output /app/publish \
    /p:UseAppHost=false

# Deployment-only image used to run the repository-pinned EF Core CLI.
FROM build AS migrations
WORKDIR /src
COPY [".config/dotnet-tools.json", ".config/dotnet-tools.json"]
RUN dotnet tool restore
RUN dotnet build "backend/ArcaneLink/ArcaneLink.csproj" \
    --configuration Release \
    --no-restore
ENTRYPOINT ["dotnet", "tool", "run", "dotnet-ef", "--"]

# Optional release gate for containerized backend tests.
FROM build AS tests
WORKDIR /src
RUN dotnet restore "backend/ArcaneLink.Tests/ArcaneLink.Tests.csproj"
RUN dotnet build "backend/ArcaneLink.Tests/ArcaneLink.Tests.csproj" \
    --configuration Release \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/storage /app/data-protection-keys \
    && chown -R "$APP_UID:$APP_UID" /app

COPY --from=publish --chown=$APP_UID:$APP_UID /app/publish .
USER $APP_UID

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail --silent --show-error http://localhost:8080/health/live || exit 1

ENTRYPOINT ["dotnet", "ArcaneLink.dll"]
