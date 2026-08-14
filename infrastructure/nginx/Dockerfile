FROM node:24.14.0-alpine AS web-source
WORKDIR /src

COPY frontend/client.web/package.json frontend/client.web/package-lock.json ./
RUN npm ci

COPY frontend/client.web/ ./

FROM web-source AS web-tests

FROM web-source AS web-build
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=web-build /src/dist/ /usr/share/nginx/html/
COPY infrastructure/nginx/conf.d/security-headers.inc /etc/nginx/snippets/security-headers.inc
COPY infrastructure/nginx/conf.d/app-locations.inc /etc/nginx/snippets/app-locations.inc
COPY infrastructure/nginx/templates/ /opt/arcanelink/nginx-templates/
COPY infrastructure/nginx/docker-entrypoint.d/19-select-arcanelink-template.sh /docker-entrypoint.d/19-select-arcanelink-template.sh

RUN chmod 0755 /docker-entrypoint.d/19-select-arcanelink-template.sh

ENV NGINX_ENVSUBST_FILTER="^(ARCANELINK_SERVER_NAME|ARCANELINK_MAX_BODY_SIZE|ARCANELINK_TLS_CERTIFICATE|ARCANELINK_TLS_CERTIFICATE_KEY)$"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --output-document=/dev/null http://127.0.0.1/nginx-health || exit 1
