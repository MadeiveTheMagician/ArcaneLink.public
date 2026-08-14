#!/bin/sh
set -eu

case "${ARCANELINK_TLS_MODE:-off}" in
  off)
    template="/opt/arcanelink/nginx-templates/arcanelink.http.conf.template"
    ;;
  letsencrypt)
    template="/opt/arcanelink/nginx-templates/arcanelink.https.conf.template"
    certificate="${ARCANELINK_TLS_CERTIFICATE:-/etc/letsencrypt/live/arcane-link.ru/fullchain.pem}"
    certificate_key="${ARCANELINK_TLS_CERTIFICATE_KEY:-/etc/letsencrypt/live/arcane-link.ru/privkey.pem}"

    if [ ! -r "$certificate" ] || [ ! -r "$certificate_key" ]; then
      echo "ArcaneLink TLS mode is enabled, but the certificate or private key is not readable." >&2
      exit 1
    fi
    ;;
  *)
    echo "Unsupported ARCANELINK_TLS_MODE: ${ARCANELINK_TLS_MODE}" >&2
    exit 1
    ;;
esac

rm -f /etc/nginx/conf.d/default.conf
mkdir -p /etc/nginx/templates
cp "$template" /etc/nginx/templates/default.conf.template
