#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
TURN_ENV_FILE="${TURN_ENV_FILE:-$ROOT_DIR/.env.turn}"
CHECK_ONLY=0
RUN_BACKUP_OVERRIDE=""
RUN_QUALITY_OVERRIDE=""
BUILD_IMAGES=1
TURN_MODE=auto

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ./infrastructure/scripts/deploy-wsl.sh [options]

Options:
  --check-only          Validate the host, environment, and Compose files only.
  --skip-pull           Compatibility flag; source updates are never automatic.
  --skip-backup         Do not create a PostgreSQL backup before deployment.
  --skip-quality-gates  Skip frontend/backend tests; EF model validation remains mandatory.
  --skip-build          Reuse existing local images.
  --with-turn           Require .env.turn and deploy the bundled TURN service.
  --without-turn        Disable bundled TURN outside Production only.
  --env-file PATH       Use an environment file other than .env.
  --turn-env-file PATH  Use a TURN environment file other than .env.turn.
  -h, --help            Show this help.
EOF
}

absolute_from_root() {
  local path="$1"
  case "$path" in
    /*) printf '%s\n' "$path" ;;
    *) printf '%s\n' "$ROOT_DIR/$path" ;;
  esac
}

read_env_value() {
  local file="$1"
  local wanted="$2"
  local line key value

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|'#'*) continue ;;
    esac

    line="${line#export }"
    key="${line%%=*}"
    [ "$key" = "$wanted" ] || continue
    value="${line#*=}"
    if [[ "$value" == \"*\" ]] || [[ "$value" == \'*\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    printf '%s\n' "$value"
    return 0
  done < "$file"

  return 1
}

effective_env_value() {
  local file="$1"
  local name="$2"
  local fallback="${3-}"

  if [ "${!name+x}" = x ]; then
    printf '%s\n' "${!name}"
    return 0
  fi

  read_env_value "$file" "$name" || printf '%s\n' "$fallback"
}

is_enabled() {
  case "${1,,}" in
    1|true|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

require_integer_in_range() {
  local name="$1"
  local value="$2"
  local minimum="$3"
  local maximum="$4"

  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be an integer"
  [ "$value" -ge "$minimum" ] && [ "$value" -le "$maximum" ] || \
    die "$name must be between $minimum and $maximum"
}

require_public_ipv4() {
  local name="$1"
  local value="$2"
  local a b c d octet

  [[ "$value" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || \
    die "$name must be a public IPv4 address"
  IFS=. read -r a b c d <<<"$value"
  for octet in "$a" "$b" "$c" "$d"; do
    [ "$octet" -ge 0 ] && [ "$octet" -le 255 ] || \
      die "$name must be a valid IPv4 address"
  done

  if [ "$a" -eq 0 ] || [ "$a" -eq 10 ] || [ "$a" -eq 127 ] || [ "$a" -ge 224 ] || \
     { [ "$a" -eq 100 ] && [ "$b" -ge 64 ] && [ "$b" -le 127 ]; } || \
     { [ "$a" -eq 169 ] && [ "$b" -eq 254 ]; } || \
     { [ "$a" -eq 172 ] && [ "$b" -ge 16 ] && [ "$b" -le 31 ]; } || \
     { [ "$a" -eq 192 ] && [ "$b" -eq 168 ]; } || \
     { [ "$a" -eq 192 ] && [ "$b" -eq 0 ] && { [ "$c" -eq 0 ] || [ "$c" -eq 2 ]; }; } || \
     { [ "$a" -eq 192 ] && [ "$b" -eq 88 ] && [ "$c" -eq 99 ]; } || \
     { [ "$a" -eq 198 ] && { [ "$b" -eq 18 ] || [ "$b" -eq 19 ]; }; } || \
     { [ "$a" -eq 198 ] && [ "$b" -eq 51 ] && [ "$c" -eq 100 ]; } || \
     { [ "$a" -eq 203 ] && [ "$b" -eq 0 ] && [ "$c" -eq 113 ]; }; then
    die "$name must not use a private, reserved, or documentation address"
  fi
}

require_bind_ipv4() {
  local name="$1"
  local value="$2"
  local a b c d octet

  [[ "$value" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || \
    die "$name must be an IPv4 address"
  IFS=. read -r a b c d <<<"$value"
  for octet in "$a" "$b" "$c" "$d"; do
    [ "$octet" -ge 0 ] && [ "$octet" -le 255 ] || \
      die "$name must be a valid IPv4 address"
  done
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command is not available: $1"
}

validate_env_file() {
  local file="$1"
  local required_prefix="${2-}"
  local line key
  declare -A seen_keys=()

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      ''|'#'*) continue ;;
    esac

    line="${line#export }"
    case "$line" in
      *=*) ;;
      *) die "Invalid environment assignment in $file" ;;
    esac

    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || \
      die "Invalid environment key in $file: $key"
    if [ -n "$required_prefix" ] && [[ "$key" != "$required_prefix"* ]]; then
      die "$file may contain only ${required_prefix}* keys; found $key"
    fi
    [ -z "${seen_keys[$key]+x}" ] || die "Duplicate environment key in $file: $key"
    seen_keys["$key"]=1
  done < "$file"
}

validate_tls_certificate() {
  local certificate="$1"
  local leaf_file chain_file failure=""

  leaf_file="$(mktemp "${TMPDIR:-/tmp}/arcanelink-tls-leaf.XXXXXX.pem")"
  chain_file="$(mktemp "${TMPDIR:-/tmp}/arcanelink-tls-chain.XXXXXX.pem")"

  if ! awk -v leaf="$leaf_file" -v chain="$chain_file" '
      /-----BEGIN CERTIFICATE-----/ { certificate_number++ }
      certificate_number == 1 { print > leaf; next }
      certificate_number > 1 { print > chain }
    ' "$certificate"; then
    failure="TLS certificate bundle could not be parsed"
  elif [ ! -s "$leaf_file" ] || [ ! -s "$chain_file" ]; then
    failure="TLS_CERTIFICATE must contain a leaf certificate and its intermediate chain"
  elif ! openssl x509 -in "$leaf_file" -noout -checkend 86400 >/dev/null 2>&1; then
    failure="TLS certificate is expired or expires within 24 hours"
  elif ! openssl x509 -in "$leaf_file" -noout -checkhost arcane-link.ru >/dev/null 2>&1; then
    failure="TLS certificate is not valid for arcane-link.ru"
  elif ! openssl verify \
      -purpose sslserver \
      -verify_hostname arcane-link.ru \
      -untrusted "$chain_file" \
      "$leaf_file" >/dev/null 2>&1; then
    failure="TLS certificate chain is not trusted by the deployment host"
  fi

  rm -f -- "$leaf_file" "$chain_file"
  [ -z "$failure" ] || die "$failure"
}

validate_nginx_config() {
  local override_file exit_code

  override_file="$(mktemp "${TMPDIR:-/tmp}/arcanelink-nginx-validation.XXXXXX.yml")"
  cat >"$override_file" <<'EOF'
services:
  nginx:
    extra_hosts:
      - "backend=127.0.0.1"
EOF

  log "Validating rendered nginx configuration and mounted TLS certificates"
  if "${COMPOSE[@]}" -f "$override_file" run --rm --no-deps nginx nginx -t; then
    exit_code=0
  else
    exit_code=$?
  fi

  rm -f -- "$override_file"
  return "$exit_code"
}

bind_addresses_overlap() {
  local left="$1"
  local right="$2"

  case "$left" in
    ''|0.0.0.0|::|'[::]') return 0 ;;
  esac
  case "$right" in
    ''|0.0.0.0|::|'[::]') return 0 ;;
  esac
  [ "$left" = "$right" ]
}

validate_docker_port_bindings() {
  local container_ids container_id metadata bindings owner_name owner_project owner_service
  local binding host_ip host_port container_port protocol host_start host_end requested_service
  local requested_index other_index conflict_key
  local -a requested_labels=("PostgreSQL" "HTTP" "HTTPS")
  local -a requested_services=(postgres nginx nginx)
  local -a requested_addresses=("$postgres_bind_address" "$http_bind_address" "$https_bind_address")
  local -a requested_starts=("$postgres_host_port" "$http_port" "$https_port")
  local -a requested_ends=("$postgres_host_port" "$http_port" "$https_port")
  local -a requested_protocols=(tcp tcp tcp)
  local -a conflicts=()
  declare -A seen_conflicts=()

  if [ "$TURN_MODE" = on ]; then
    requested_labels+=("TURN control" "TURN control" "TURN relay range")
    requested_services+=(turn turn turn)
    requested_addresses+=("$turn_bind_address" "$turn_bind_address" "$turn_bind_address")
    requested_starts+=(3478 3478 "$turn_min_port")
    requested_ends+=(3478 3478 "$turn_max_port")
    requested_protocols+=(tcp udp udp)
  fi

  for requested_index in "${!requested_labels[@]}"; do
    for ((other_index = requested_index + 1; other_index < ${#requested_labels[@]}; other_index++)); do
      [ "${requested_protocols[$requested_index]}" = "${requested_protocols[$other_index]}" ] || continue
      bind_addresses_overlap "${requested_addresses[$requested_index]}" "${requested_addresses[$other_index]}" || continue
      [ "${requested_starts[$requested_index]}" -le "${requested_ends[$other_index]}" ] && \
        [ "${requested_starts[$other_index]}" -le "${requested_ends[$requested_index]}" ] || continue
      die "Configured host bindings overlap: ${requested_labels[$requested_index]} and ${requested_labels[$other_index]}"
    done
  done

  container_ids="$(docker ps --quiet)" || die "Unable to inspect running Docker containers"
  while IFS= read -r container_id; do
    [ -n "$container_id" ] || continue
    metadata="$(docker inspect --format '{{.Name}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' "$container_id")" || \
      die "Unable to inspect Docker container $container_id"
    IFS='|' read -r owner_name owner_project owner_service <<<"$metadata"
    owner_name="${owner_name#/}"
    [ "$owner_project" != '<no value>' ] || owner_project=""
    [ "$owner_service" != '<no value>' ] || owner_service=""

    bindings="$(docker inspect --format '{{range $containerPort, $bindings := .NetworkSettings.Ports}}{{range $bindings}}{{printf "%s|%s|%s\n" .HostIp .HostPort $containerPort}}{{end}}{{end}}' "$container_id")" || \
      die "Unable to inspect published ports for Docker container $container_id"
    while IFS= read -r binding; do
      [ -n "$binding" ] || continue
      IFS='|' read -r host_ip host_port container_port <<<"$binding"
      protocol="${container_port##*/}"
      case "$host_port" in
        *-*) host_start="${host_port%%-*}"; host_end="${host_port##*-}" ;;
        *) host_start="$host_port"; host_end="$host_port" ;;
      esac
      [[ "$host_start" =~ ^[0-9]+$ && "$host_end" =~ ^[0-9]+$ ]] || continue

      for requested_index in "${!requested_labels[@]}"; do
        [ "$protocol" = "${requested_protocols[$requested_index]}" ] || continue
        bind_addresses_overlap "${requested_addresses[$requested_index]}" "$host_ip" || continue
        [ "$host_start" -le "${requested_ends[$requested_index]}" ] && \
          [ "${requested_starts[$requested_index]}" -le "$host_end" ] || continue
        requested_service="${requested_services[$requested_index]}"
        if [ "$owner_project" = "$compose_project_name" ] && [ "$owner_service" = "$requested_service" ]; then
          continue
        fi

        conflict_key="${requested_labels[$requested_index]}|$owner_name"
        [ -z "${seen_conflicts[$conflict_key]+x}" ] || continue
        seen_conflicts["$conflict_key"]=1
        conflicts+=("${requested_labels[$requested_index]} ${requested_addresses[$requested_index]}:${requested_starts[$requested_index]}-${requested_ends[$requested_index]}/${requested_protocols[$requested_index]} is owned by $owner_name (Compose project: ${owner_project:-unlabelled}, service: ${owner_service:-unknown})")
      done
    done <<<"$bindings"
  done <<<"$container_ids"

  if [ "${#conflicts[@]}" -gt 0 ]; then
    printf 'Error: required host ports are already used by another Docker container or service:\n' >&2
    printf '  - %s\n' "${conflicts[@]}" >&2
    die "Stop the conflicting stack or assign non-overlapping ports before deploying $compose_project_name"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check-only) CHECK_ONLY=1 ;;
    --skip-pull) : ;;
    --skip-backup) RUN_BACKUP_OVERRIDE=0 ;;
    --skip-quality-gates) RUN_QUALITY_OVERRIDE=0 ;;
    --skip-build) BUILD_IMAGES=0 ;;
    --with-turn) TURN_MODE=on ;;
    --without-turn) TURN_MODE=off ;;
    --env-file)
      [ "$#" -ge 2 ] || die "--env-file requires a path"
      ENV_FILE="$2"
      shift
      ;;
    --turn-env-file)
      [ "$#" -ge 2 ] || die "--turn-env-file requires a path"
      TURN_ENV_FILE="$2"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "Unknown option: $1"
      ;;
  esac
  shift
done

ENV_FILE="$(absolute_from_root "$ENV_FILE")"
TURN_ENV_FILE="$(absolute_from_root "$TURN_ENV_FILE")"

require_command docker
require_command curl
require_command mktemp
docker compose version >/dev/null
[ -f "$ENV_FILE" ] || die "Environment file not found: $ENV_FILE (copy .env.example first)"
validate_env_file "$ENV_FILE"

postgres_password="$(effective_env_value "$ENV_FILE" POSTGRES_PASSWORD)"
jwt_secret="$(effective_env_value "$ENV_FILE" JWT_SECRET)"
app_environment="$(effective_env_value "$ENV_FILE" ASPNETCORE_ENVIRONMENT Production)"
compose_project_name="$(effective_env_value "$ENV_FILE" COMPOSE_PROJECT_NAME arcanelink)"
allowed_hosts="$(effective_env_value "$ENV_FILE" ALLOWED_HOSTS)"
server_name="$(effective_env_value "$ENV_FILE" ARCANELINK_SERVER_NAME localhost)"
tls_mode="$(effective_env_value "$ENV_FILE" ARCANELINK_TLS_MODE off)"
http_bind_address="$(effective_env_value "$ENV_FILE" HTTP_BIND_ADDRESS 127.0.0.1)"
http_port="$(effective_env_value "$ENV_FILE" HTTP_PORT 8080)"
https_bind_address="$(effective_env_value "$ENV_FILE" HTTPS_BIND_ADDRESS 127.0.0.1)"
https_port="$(effective_env_value "$ENV_FILE" HTTPS_PORT 8443)"
postgres_bind_address="$(effective_env_value "$ENV_FILE" POSTGRES_BIND_ADDRESS 127.0.0.1)"
postgres_host_port="$(effective_env_value "$ENV_FILE" POSTGRES_HOST_PORT 5433)"
[ -n "$http_bind_address" ] || http_bind_address=127.0.0.1
[ -n "$http_port" ] || http_port=8080
[ -n "$https_bind_address" ] || https_bind_address=127.0.0.1
[ -n "$https_port" ] || https_port=8443
[ -n "$postgres_bind_address" ] || postgres_bind_address=127.0.0.1
[ -n "$postgres_host_port" ] || postgres_host_port=5433
tls_certificates_dir="$(effective_env_value "$ENV_FILE" TLS_CERTIFICATES_DIR "$ROOT_DIR/infrastructure/nginx/certs")"
tls_certificate="$(effective_env_value "$ENV_FILE" ARCANELINK_TLS_CERTIFICATE /etc/letsencrypt/live/arcane-link.ru/fullchain.pem)"
tls_certificate_key="$(effective_env_value "$ENV_FILE" ARCANELINK_TLS_CERTIFICATE_KEY /etc/letsencrypt/live/arcane-link.ru/privkey.pem)"
public_origin="$(effective_env_value "$ENV_FILE" PUBLIC_ORIGIN)"
smoke_resolve="$(effective_env_value "$ENV_FILE" SMOKE_RESOLVE)"
[ -n "$postgres_password" ] || die "POSTGRES_PASSWORD is missing from $ENV_FILE"
[ -n "$jwt_secret" ] || die "JWT_SECRET is missing from $ENV_FILE"
[ -n "$compose_project_name" ] || die "COMPOSE_PROJECT_NAME is missing from $ENV_FILE"
[ -n "$public_origin" ] || die "PUBLIC_ORIGIN is missing from $ENV_FILE"
[[ "$postgres_password" != *replace-with* && "$postgres_password" != *change-me* ]] || die "Replace the example POSTGRES_PASSWORD before deployment"
[[ "$jwt_secret" != *replace-with* && "$jwt_secret" != *change-me* ]] || die "Replace the example JWT_SECRET before deployment"
[ "${#jwt_secret}" -ge 32 ] || die "JWT_SECRET must contain at least 32 characters"
require_integer_in_range HTTP_PORT "$http_port" 1 65535
require_integer_in_range HTTPS_PORT "$https_port" 1 65535
require_integer_in_range POSTGRES_HOST_PORT "$postgres_host_port" 1 65535
require_bind_ipv4 HTTP_BIND_ADDRESS "$http_bind_address"
require_bind_ipv4 HTTPS_BIND_ADDRESS "$https_bind_address"
require_bind_ipv4 POSTGRES_BIND_ADDRESS "$postgres_bind_address"

case "${tls_mode,,}" in
  off)
    [[ "$public_origin" == http://* ]] || \
      die "ARCANELINK_TLS_MODE=off requires an http:// PUBLIC_ORIGIN"
    ;;
  letsencrypt)
    [[ "$public_origin" == https://* ]] || \
      die "ARCANELINK_TLS_MODE=letsencrypt requires an https:// PUBLIC_ORIGIN"
    ;;
  *)
    die "ARCANELINK_TLS_MODE must be either off or letsencrypt"
    ;;
esac

if [ "${app_environment,,}" = production ]; then
  [ "${tls_mode,,}" = letsencrypt ] || \
    die "Production deployment requires ARCANELINK_TLS_MODE=letsencrypt"
  [ -n "$allowed_hosts" ] && [ "$allowed_hosts" != "*" ] || \
    die "Production ALLOWED_HOSTS must list explicit host names"
  [ "$server_name" != localhost ] || \
    die "Production ARCANELINK_SERVER_NAME must list the public host names"
  [ "$http_bind_address" = 0.0.0.0 ] && [ "$http_port" = 80 ] || \
    die "Production HTTP listener must be published as 0.0.0.0:80"
  [ "$https_bind_address" = 0.0.0.0 ] && [ "$https_port" = 443 ] || \
    die "Production HTTPS listener must be published as 0.0.0.0:443"
  [ -n "$smoke_resolve" ] || \
    die "Production SMOKE_RESOLVE must route the canonical HTTPS check to the local nginx listener"
  [ "${public_origin%/}" = https://arcane-link.ru ] || \
    die "Production PUBLIC_ORIGIN must be https://arcane-link.ru"
  [ "$smoke_resolve" = arcane-link.ru:443:127.0.0.1 ] || \
    die "Production SMOKE_RESOLVE must be arcane-link.ru:443:127.0.0.1"
  case ";$allowed_hosts;" in
    *';arcane-link.ru;'*) ;;
    *) die "Production ALLOWED_HOSTS must include arcane-link.ru" ;;
  esac
  case " $server_name " in
    *' arcane-link.ru '*) ;;
    *) die "Production ARCANELINK_SERVER_NAME must include arcane-link.ru" ;;
  esac
  if [ "$compose_project_name" != arcanelink ]; then
    log "Warning: preserving COMPOSE_PROJECT_NAME=$compose_project_name; changing it would select different named volumes"
  fi

  case "$tls_certificates_dir" in
    /*) ;;
    *) tls_certificates_dir="$ROOT_DIR/$tls_certificates_dir" ;;
  esac
  case "$tls_certificate" in
    /etc/letsencrypt/*)
      tls_certificate_relative="${tls_certificate#/etc/letsencrypt/}"
      case "$tls_certificate_relative" in
        ''|..|../*|*/../*|*/..) die "Invalid TLS certificate path: $tls_certificate" ;;
      esac
      tls_certificate_host="$tls_certificates_dir/$tls_certificate_relative"
      ;;
    *) die "ARCANELINK_TLS_CERTIFICATE must be below /etc/letsencrypt" ;;
  esac
  case "$tls_certificate_key" in
    /etc/letsencrypt/*)
      tls_certificate_key_relative="${tls_certificate_key#/etc/letsencrypt/}"
      case "$tls_certificate_key_relative" in
        ''|..|../*|*/../*|*/..) die "Invalid TLS private key path: $tls_certificate_key" ;;
      esac
      tls_certificate_key_host="$tls_certificates_dir/$tls_certificate_key_relative"
      ;;
    *) die "ARCANELINK_TLS_CERTIFICATE_KEY must be below /etc/letsencrypt" ;;
  esac
  [ -f "$tls_certificate_host" ] && [ -r "$tls_certificate_host" ] || \
    die "TLS certificate is missing or unreadable: $tls_certificate_host"
  [ -f "$tls_certificate_key_host" ] && [ -r "$tls_certificate_key_host" ] || \
    die "TLS private key is missing or unreadable: $tls_certificate_key_host"
  require_command awk
  require_command openssl
  validate_tls_certificate "$tls_certificate_host"
fi

case "$TURN_MODE" in
  auto)
    if [ -f "$TURN_ENV_FILE" ]; then
      TURN_MODE=on
    elif [ "${app_environment,,}" = production ]; then
      die "Production deployment requires $TURN_ENV_FILE and the bundled TURN service"
    else
      TURN_MODE=off
    fi
    ;;
  on)
    [ -f "$TURN_ENV_FILE" ] || die "TURN environment file not found: $TURN_ENV_FILE"
    ;;
  off)
    [ "${app_environment,,}" != production ] || \
      die "--without-turn is not allowed when ASPNETCORE_ENVIRONMENT=Production"
    ;;
esac

COMPOSE=(
  docker compose
  --project-directory "$ROOT_DIR"
  --env-file "$ENV_FILE"
  -f "$ROOT_DIR/docker-compose.yml"
)

if [ "$TURN_MODE" = on ]; then
  validate_env_file "$TURN_ENV_FILE" TURN_
  turn_realm="$(effective_env_value "$TURN_ENV_FILE" TURN_REALM)"
  turn_bind_address="$(effective_env_value "$TURN_ENV_FILE" TURN_BIND_ADDRESS 0.0.0.0)"
  [ -n "$turn_bind_address" ] || turn_bind_address=0.0.0.0
  turn_public_host="$(effective_env_value "$TURN_ENV_FILE" TURN_PUBLIC_HOST)"
  turn_shared_secret="$(effective_env_value "$TURN_ENV_FILE" TURN_SHARED_SECRET)"
  turn_external_ip="$(effective_env_value "$TURN_ENV_FILE" TURN_EXTERNAL_IP)"
  turn_credential_ttl="$(effective_env_value "$TURN_ENV_FILE" TURN_CREDENTIAL_TTL_SECONDS 600)"
  turn_credential_limit="$(effective_env_value "$TURN_ENV_FILE" TURN_CREDENTIAL_PERMIT_LIMIT 12)"
  turn_credential_window="$(effective_env_value "$TURN_ENV_FILE" TURN_CREDENTIAL_WINDOW_SECONDS 60)"
  turn_user_quota="$(effective_env_value "$TURN_ENV_FILE" TURN_USER_QUOTA)"
  turn_total_quota="$(effective_env_value "$TURN_ENV_FILE" TURN_TOTAL_QUOTA)"
  turn_max_bps="$(effective_env_value "$TURN_ENV_FILE" TURN_MAX_BPS)"
  turn_bps_capacity="$(effective_env_value "$TURN_ENV_FILE" TURN_BPS_CAPACITY)"
  turn_min_port="$(effective_env_value "$TURN_ENV_FILE" TURN_MIN_PORT 49160)"
  turn_max_port="$(effective_env_value "$TURN_ENV_FILE" TURN_MAX_PORT 49200)"
  [ -n "$turn_credential_ttl" ] || turn_credential_ttl=600
  [ -n "$turn_credential_limit" ] || turn_credential_limit=12
  [ -n "$turn_credential_window" ] || turn_credential_window=60
  [ -n "$turn_min_port" ] || turn_min_port=49160
  [ -n "$turn_max_port" ] || turn_max_port=49200
  [ -n "$turn_realm" ] && [ -n "$turn_public_host" ] && [ -n "$turn_shared_secret" ] && [ -n "$turn_external_ip" ] || die "TURN_REALM, TURN_PUBLIC_HOST, TURN_SHARED_SECRET, and TURN_EXTERNAL_IP are required"
  [[ "$turn_shared_secret" != *replace-with* && "$turn_shared_secret" != *change-me* ]] || die "Replace the example TURN_SHARED_SECRET before deployment"
  [ "${#turn_shared_secret}" -ge 32 ] || die "TURN_SHARED_SECRET must contain at least 32 characters"
  require_public_ipv4 TURN_EXTERNAL_IP "$turn_external_ip"
  [ -n "$turn_user_quota" ] && [ -n "$turn_total_quota" ] && [ -n "$turn_max_bps" ] && [ -n "$turn_bps_capacity" ] || \
    die "TURN_USER_QUOTA, TURN_TOTAL_QUOTA, TURN_MAX_BPS, and TURN_BPS_CAPACITY are required"
  require_integer_in_range TURN_CREDENTIAL_TTL_SECONDS "$turn_credential_ttl" 60 3600
  require_integer_in_range TURN_CREDENTIAL_PERMIT_LIMIT "$turn_credential_limit" 1 10000
  require_integer_in_range TURN_CREDENTIAL_WINDOW_SECONDS "$turn_credential_window" 1 3600
  require_integer_in_range TURN_USER_QUOTA "$turn_user_quota" 1 1000000
  require_integer_in_range TURN_TOTAL_QUOTA "$turn_total_quota" 1 10000000
  require_integer_in_range TURN_MAX_BPS "$turn_max_bps" 1 100000000000
  require_integer_in_range TURN_BPS_CAPACITY "$turn_bps_capacity" 1 1000000000000
  require_integer_in_range TURN_MIN_PORT "$turn_min_port" 1024 65535
  require_integer_in_range TURN_MAX_PORT "$turn_max_port" 1024 65535
  require_bind_ipv4 TURN_BIND_ADDRESS "$turn_bind_address"
  [ "$turn_min_port" -le "$turn_max_port" ] || die "TURN_MIN_PORT must not exceed TURN_MAX_PORT"
  [ "$turn_user_quota" -le "$turn_total_quota" ] || die "TURN_USER_QUOTA must not exceed TURN_TOTAL_QUOTA"
  turn_port_count=$((turn_max_port - turn_min_port + 1))
  [ "$turn_total_quota" -le "$turn_port_count" ] || \
    die "TURN_TOTAL_QUOTA must not exceed the configured relay port count ($turn_port_count)"
  [ "$turn_max_bps" -le "$turn_bps_capacity" ] || die "TURN_MAX_BPS must not exceed TURN_BPS_CAPACITY"
  COMPOSE+=(
    --env-file "$TURN_ENV_FILE"
    -f "$ROOT_DIR/docker-compose.turn.yml"
  )
fi

log "Validating Docker Compose configuration"
"${COMPOSE[@]}" config --quiet
validate_docker_port_bindings

if [ "$CHECK_ONLY" -eq 1 ]; then
  log "Deployment preflight passed; no services were changed"
  exit 0
fi

run_backup="$(read_env_value "$ENV_FILE" RUN_BACKUP || printf '1')"
if [ -n "$RUN_BACKUP_OVERRIDE" ]; then run_backup="$RUN_BACKUP_OVERRIDE"; fi

if is_enabled "$run_backup"; then
  if ! "${COMPOSE[@]}" ps --services --status running | grep -Fxq postgres; then
    postgres_volume="$(docker volume ls \
      --quiet \
      --filter "label=com.docker.compose.project=$compose_project_name" \
      --filter "label=com.docker.compose.volume=postgres_data")"
    if [ -n "$postgres_volume" ]; then
      log "Starting the existing PostgreSQL service for a verified backup"
      "${COMPOSE[@]}" up --detach --wait --wait-timeout 120 postgres
    fi
  fi

  if "${COMPOSE[@]}" ps --services --status running | grep -Fxq postgres; then
    log "Creating a pre-deployment PostgreSQL backup"
    ENV_FILE="$ENV_FILE" bash "$SCRIPT_DIR/backup-postgres.sh"
  else
    log "No existing PostgreSQL volume was found; backup is not required for this first deployment"
  fi
fi

run_quality="$(read_env_value "$ENV_FILE" RUN_QUALITY_GATES || printf '1')"
if [ -n "$RUN_QUALITY_OVERRIDE" ]; then run_quality="$RUN_QUALITY_OVERRIDE"; fi

if is_enabled "$run_quality"; then
  log "Building the containerized release quality gates"
  "${COMPOSE[@]}" --profile tools build frontend-tests backend-tests

  log "Running frontend lint, unit tests, type checking, and production build"
  "${COMPOSE[@]}" --profile tools run --rm --no-deps frontend-tests \
    sh -euc '
      npm run lint
      npm run test:unit
      npm run build
    '

  log "Running backend tests"
  "${COMPOSE[@]}" --profile tools run --rm --no-deps backend-tests \
    dotnet test "backend/ArcaneLink.Tests/ArcaneLink.Tests.csproj" \
      --configuration Release \
      --no-build \
      --no-restore \
      --filter "FullyQualifiedName!~ArcaneLink.Tests.PostgreSql" \
      --logger "console;verbosity=detailed"
fi

if [ "$BUILD_IMAGES" -eq 1 ]; then
  log "Building backend, migration, and web proxy images"
  "${COMPOSE[@]}" build backend migrations nginx
fi

log "Checking the EF Core model for a matching migration"
"${COMPOSE[@]}" --profile tools run --rm --no-deps migrations \
  migrations has-pending-model-changes \
    --project "backend/ArcaneLink/ArcaneLink.csproj" \
    --startup-project "backend/ArcaneLink/ArcaneLink.csproj" \
    --configuration Release \
    --no-build

validate_nginx_config

log "Applying migrations and replacing application services"
"${COMPOSE[@]}" rm --force --stop migrations >/dev/null 2>&1 || true

UP_ARGS=(up --detach --remove-orphans --wait --wait-timeout 240)
if [ "$BUILD_IMAGES" -eq 0 ]; then UP_ARGS+=(--no-build); fi
"${COMPOSE[@]}" "${UP_ARGS[@]}"

if [ -n "$public_origin" ]; then
  CURL_ARGS=(--fail --silent --show-error --max-time 20)
  if [ -n "$smoke_resolve" ]; then CURL_ARGS+=(--resolve "$smoke_resolve"); fi

  log "Checking application readiness at ${public_origin%/}/health/ready"
  curl "${CURL_ARGS[@]}" "${public_origin%/}/health/ready" >/dev/null
fi

log "Deployment completed"
"${COMPOSE[@]}" ps
