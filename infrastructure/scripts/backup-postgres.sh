#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
OUTPUT_DIR=""
RETENTION_DAYS=""

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: ./infrastructure/scripts/backup-postgres.sh [options]

Options:
  --env-file PATH       Use an environment file other than .env.
  --output-dir PATH     Store backups in this directory.
  --retention-days N    Remove ArcaneLink backups older than N days (0 disables cleanup).
  -h, --help            Show this help.
EOF
}

read_env_value() {
  local file="$1"
  local wanted="$2"
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
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

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      [ "$#" -ge 2 ] || die "--env-file requires a path"
      ENV_FILE="$2"
      shift
      ;;
    --output-dir)
      [ "$#" -ge 2 ] || die "--output-dir requires a path"
      OUTPUT_DIR="$2"
      shift
      ;;
    --retention-days)
      [ "$#" -ge 2 ] || die "--retention-days requires a value"
      RETENTION_DAYS="$2"
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

case "$ENV_FILE" in /*) ;; *) ENV_FILE="$ROOT_DIR/$ENV_FILE" ;; esac
[ -f "$ENV_FILE" ] || die "Environment file not found: $ENV_FILE"

if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="$(read_env_value "$ENV_FILE" BACKUP_DIR || printf './backups')"
fi
case "$OUTPUT_DIR" in /*) ;; *) OUTPUT_DIR="$ROOT_DIR/${OUTPUT_DIR#./}" ;; esac
[ "$OUTPUT_DIR" != "/" ] || die "The filesystem root cannot be used as a backup directory"

if [ -z "$RETENTION_DAYS" ]; then
  RETENTION_DAYS="$(read_env_value "$ENV_FILE" BACKUP_RETENTION_DAYS || printf '14')"
fi
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "Retention days must be a non-negative integer"

COMPOSE=(
  docker compose
  --project-directory "$ROOT_DIR"
  --env-file "$ENV_FILE"
  -f "$ROOT_DIR/docker-compose.yml"
)

"${COMPOSE[@]}" ps --services --status running | grep -Fxq postgres || die "The PostgreSQL service is not running"

umask 077
mkdir -p -- "$OUTPUT_DIR"
timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
backup_path="$OUTPUT_DIR/arcanelink-$timestamp.dump"
temporary_path="$backup_path.partial"
trap 'rm -f -- "$temporary_path"' EXIT

"${COMPOSE[@]}" exec -T postgres sh -eu -c \
  'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$temporary_path"

[ -s "$temporary_path" ] || die "PostgreSQL produced an empty backup"
"${COMPOSE[@]}" exec -T postgres pg_restore --list < "$temporary_path" >/dev/null
mv -- "$temporary_path" "$backup_path"
trap - EXIT

if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$OUTPUT_DIR" -maxdepth 1 -type f -name 'arcanelink-*.dump' -mtime "+$RETENTION_DAYS" -delete
fi

printf 'Backup created: %s\n' "$backup_path"
