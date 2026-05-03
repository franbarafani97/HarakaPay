#!/usr/bin/env bash
#
# Script to automatically start up the whole application.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { printf "\n\033[1;34m==>\033[0m %s\n" "$1"; }
note() { printf "    %s\n" "$1"; }

if [ -z "${NVM_DIR:-}" ]; then export NVM_DIR="$HOME/.nvm"; fi

[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
if command -v nvm >/dev/null && [ -f .nvmrc ]; then
  nvm use >/dev/null 2>&1 || true
fi

# Check Docker daemon status
step "Docker"
if ! docker info >/dev/null 2>&1; then
  echo "    Docker daemon is not running."
  echo "    Start Docker Desktop, then re-run: bash scripts/dev.sh"
  exit 1
fi

# Start Postgres
step "Postgres"
docker compose up -d
note "Waiting for Postgres to accept connections..."
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U harakapay -d harakapay >/dev/null 2>&1; then
    note "Postgres ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "    Timed out waiting for Postgres."; exit 1
  fi
done

# Start API and Web
step "Starting API + web (Ctrl-C to stop)"
exec pnpm exec concurrently \
  --names "api,web" \
  --prefix-colors "blue.bold,green.bold" \
  --kill-others-on-fail \
  "pnpm --filter @harakapay/api dev" \
  "pnpm --filter @harakapay/web dev"
