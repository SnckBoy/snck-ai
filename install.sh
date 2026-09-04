#!/usr/bin/env bash
#
# Snck AI - one-command installer for an Ubuntu VPS (uses Docker Compose)
#
# Usage (fresh VPS, as root or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash
#
# Optional environment overrides:
#   SNCK_DIR         install directory                     (default /opt/snck-ai)
#   SNCK_PORT        public HTTP port                      (default 3000)
#   SNCK_APP_URL     public base URL                       (default http://<public-ip>:<port>)
#   SNCK_DB_PASSWORD PostgreSQL password                   (default: random)
#   SNCK_AUTH_SECRET JWT signing secret                    (default: random)
#   SNCK_ENCRYPTION_KEY 32-byte hex key for provider keys  (default: random)
#
# Re-running this script updates Snck AI in place (git pull + rebuild).

set -euo pipefail

REPO_URL="https://github.com/SnckBoy/snck-ai.git"
INSTALL_DIR="${SNCK_DIR:-/opt/snck-ai}"
PORT="${SNCK_PORT:-3000}"
APP_URL="${SNCK_APP_URL:-}"
DB_PASSWORD="${SNCK_DB_PASSWORD:-$(openssl rand -hex 16)}"
AUTH_SECRET="${SNCK_AUTH_SECRET:-$(openssl rand -base64 32)}"
ENCRYPTION_KEY="${SNCK_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"

log() { printf '\n[snck] %s\n' "$*"; }
die() { printf '\n[snck] ERROR: %s\n' "$*" >&2; exit 1; }

# --- Root check ------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  die "Please run as root:  curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash"
fi

# --- Base tools ------------------------------------------------------------
if ! command -v curl >/dev/null 2>&1; then
  log "Installing curl"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl ca-certificates openssl git
fi

# --- Obtain the repository --------------------------------------------------
if [ -f "docker-compose.yml" ] && [ -d "src" ] && [ -d ".git" ]; then
  INSTALL_DIR="$PWD"
  log "Using current repository: $INSTALL_DIR"
else
  mkdir -p "$INSTALL_DIR"
  if [ ! -d "$INSTALL_DIR/.git" ]; then
    log "Cloning Snck AI into $INSTALL_DIR"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  else
    log "Updating existing install in $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --depth 1 origin
    git -C "$INSTALL_DIR" checkout -q origin/main -- .
  fi
  cd "$INSTALL_DIR"
fi

# --- Docker Engine + Compose ------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine (this can take a minute)"
  export DEBIAN_FRONTEND=noninteractive
  curl -fsSL https://get.docker.com | sh || apt-get install -y docker.io docker-compose-v2
fi

log "Enabling the Docker service"
systemctl enable docker >/dev/null 2>&1 || true
systemctl start docker >/dev/null 2>&1 || true

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose v2 is missing. Install it with:  apt-get install -y docker-compose-v2"
fi

# --- Detect public address ---------------------------------------------------
if [ -z "$APP_URL" ]; then
  PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  [ -z "$PUBLIC_IP" ] && PUBLIC_IP="localhost"
  APP_URL="http://${PUBLIC_IP}:${PORT}"
fi

# --- Write secrets to .env (kept if already present) --------------------------
log "Writing environment secrets to $INSTALL_DIR/.env"
if [ ! -f .env ]; then
  {
    printf 'AUTH_SECRET=%s\n' "$AUTH_SECRET"
    printf 'ENCRYPTION_KEY=%s\n' "$ENCRYPTION_KEY"
    printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD"
    printf 'PORT=%s\n' "$PORT"
    printf 'APP_URL=%s\n' "$APP_URL"
  } > .env
  chmod 600 .env
else
  if ! grep -q '^APP_URL=' .env; then
    printf 'APP_URL=%s\n' "$APP_URL" >> .env
  fi
fi

# --- Build and start ----------------------------------------------------------
log "Building and starting containers (first build can take several minutes)"
docker compose up -d --build

# --- Wait for the app ---------------------------------------------------------
log "Waiting for Snck AI to come up on http://127.0.0.1:${PORT}"
READY=0
for _ in $(seq 1 60); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${PORT}/login" || true)"
  if [ "$CODE" = "200" ]; then
    READY=1
    break
  fi
  sleep 5
done
[ "$READY" -eq 1 ] || die "Snck AI did not become ready. Check logs with:  cd $INSTALL_DIR && docker compose logs -f app"

# --- Firewall -----------------------------------------------------------------
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  log "Opening TCP port ${PORT} in ufw"
  ufw allow "${PORT}/tcp" >/dev/null || true
fi

# --- Done ---------------------------------------------------------------------
log "Snck AI is running at: $APP_URL"
printf '\n'
printf '  * Visit %s and register the FIRST account. That user becomes the Owner.\n' "$APP_URL"
printf '  * Owner dashboard: %s/admin\n' "$APP_URL"
printf '  * Data lives in the Docker volume "snck_pgdata". Back it up with:\n'
printf '      docker run --rm -v snck-ai_snck_pgdata:/data -v "$PWD":/backup alpine tar czf /backup/snck_db.tar.gz -C /data .\n'
printf '  * Update later by re-running the same command.\n'
printf '\n[snck] Install finished successfully.\n'
