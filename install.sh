#!/usr/bin/env bash
#
# Snck AI - one-command installer for an Ubuntu VPS (uses Docker Compose)
#
# What you can do:
#   1) Install the Snck AI panel (fresh install or reinstall)
#   2) Update the Snck AI AI from the GitHub repo (git pull + rebuild,
#      keeps your database and secrets)
#
# Usage (fresh VPS, as root or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash
#
#   # Interactive: running it with no arguments shows a menu:
#   #   1) Install Snck AI panel
#   #   2) Update Snck AI from GitHub
#   #
#   # When piped (curl | sudo bash) there is no terminal, so it installs.
#
#   # Force a mode explicitly:
#   curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash -s panel
#   curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash -s update
#
# Optional environment overrides:
#   SNCK_DIR         install directory                     (default /opt/snck-ai)
#   SNCK_PORT        public HTTP port                      (default 3000)
#   SNCK_APP_URL     public base URL                       (default http://<public-ip>:<port>)
#   SNCK_DB_PASSWORD PostgreSQL password                   (default: random)
#   SNCK_AUTH_SECRET JWT signing secret                    (default: random)
#   SNCK_ENCRYPTION_KEY 32-byte hex key for provider keys  (default: random)
#

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
require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    die "Please run as root:  curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash"
  fi
}

# --- Find where the repository lives ---------------------------------------
# When run inside the repo directory it uses $PWD; otherwise the install dir.
find_install_dir() {
  if [ -f "docker-compose.yml" ] && [ -d "src" ] && [ -d ".git" ]; then
    INSTALL_DIR="$PWD"
  fi
  echo "$INSTALL_DIR"
}

# --- Wait for the app to answer --------------------------------------------
wait_ready() {
  local dir="$1" port="$2"
  log "Waiting for Snck AI to come up on http://127.0.0.1:${port}"
  local READY=0
  local CODE
  for _ in $(seq 1 60); do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${port}/login" || true)"
    if [ "$CODE" = "200" ]; then
      READY=1
      break
    fi
    sleep 5
  done
  if [ "$READY" -eq 1 ]; then
    return 0
  fi
  die "Snck AI did not become ready. Check logs with:  cd $dir && docker compose logs -f app"
}

# --- Get the repository up to date -----------------------------------------
sync_repo() {
  local dir="$1"
  if [ ! -d "$dir/.git" ]; then
    log "Cloning Snck AI into $dir"
    mkdir -p "$dir"
    git clone --depth 1 "$REPO_URL" "$dir"
  else
    log "Updating Snck AI code from GitHub in $dir"
    git -C "$dir" fetch --depth 1 origin main
    git -C "$dir" reset --hard -q FETCH_HEAD
  fi
  cd "$dir"
}

install_base_tools() {
  if ! command -v curl >/dev/null 2>&1; then
    log "Installing curl"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl ca-certificates openssl git
  fi
}

ensure_docker() {
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
}

detect_public_address() {
  if [ -n "$APP_URL" ]; then
    return
  fi
  local PUBLIC_IP
  PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  [ -z "$PUBLIC_IP" ] && PUBLIC_IP="localhost"
  APP_URL="http://${PUBLIC_IP}:${PORT}"
}

write_env() {
  local dir="$1"
  log "Writing environment secrets to $dir/.env"
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
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    log "Opening TCP port ${PORT} in ufw"
    ufw allow "${PORT}/tcp" >/dev/null || true
  fi
}

print_done() {
  local app_url="$1" dir="$2"
  log "Snck AI is running at: $app_url"
  printf '\n'
  printf '  * Visit %s and register the FIRST account. That user becomes the Owner.\n' "$app_url"
  printf '  * Owner dashboard: %s/admin\n' "$app_url"
  printf '  * Data lives in the Docker volume "snck-ai_snck_pgdata". Back it up with:\n'
  printf '      docker run --rm -v snck-ai_snck_pgdata:/data -v "$PWD":/backup alpine tar czf /backup/snck_db.tar.gz -C /data .\n'
  printf '  * Update later by re-running the same command and choosing "Update".\n'
  printf '\n[snck] Finished successfully.\n'
}

# --- Mode 1: Install (or reinstall) the panel ------------------------------
install_panel() {
  require_root
  local dir
  dir="$(find_install_dir)"

  install_base_tools
  sync_repo "$dir"
  ensure_docker
  detect_public_address
  write_env "$dir"
  log "Building and starting containers (first build can take several minutes)"
  docker compose up -d --build
  wait_ready "$dir" "$PORT"
  open_firewall
  print_done "$APP_URL" "$dir"
}

# --- Mode 2: Update the AI from GitHub -------------------------------------
update_ai() {
  require_root
  local dir
  dir="$(find_install_dir)"

  if [ ! -d "$dir/.git" ]; then
    die "Snck AI is not installed yet in $dir. Install it first:  curl -fsSL https://raw.githubusercontent.com/SnckBoy/snck-ai/main/install.sh | sudo bash"
  fi

  install_base_tools
  ensure_docker
  sync_repo "$dir"

  if [ -f .env ]; then
    export PORT="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2- || echo "$PORT")"
    export APP_URL="$(grep -E '^APP_URL=' .env | tail -1 | cut -d= -f2- || echo "$APP_URL")"
    [ -z "$APP_URL" ] && APP_URL="http://127.0.0.1:${PORT}"
  fi

  log "Rebuilding and restarting containers"
  docker compose up -d --build
  wait_ready "$dir" "$PORT"
  log "Snck AI has been updated and is running at: $APP_URL"
}

# --- Dispatch ---------------------------------------------------------------
MODE="${1:-}"
if [ -z "$MODE" ]; then
  if [ -t 0 ] && [ -t 1 ]; then
    printf '\n[snck] What do you want to do?\n'
    printf '  1) Install the Snck AI panel (fresh install or reinstall)\n'
    printf '  2) Update Snck AI from GitHub (keeps your data and secrets)\n'
    printf '\nEnter 1 or 2: '
    read -r choice
    case "$choice" in
      2|update|u) MODE=update ;;
      *)          MODE=install ;;
    esac
  else
    MODE=install
  fi
fi

case "$MODE" in
  panel|install|install-panel|1) install_panel ;;
  update|update-ai|2)            update_ai ;;
  help|-h|--help)
    printf 'Usage: bash install.sh [panel|update]\n'
    printf '  panel   Install the Snck AI panel (default)\n'
    printf '  update  Update Snck AI from the GitHub repo\n'
    ;;
  *) die "Unknown mode '$MODE'. Use 'panel' or 'update'." ;;
esac
