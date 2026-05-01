#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PID=""
FRONTEND_SERVER_PID=""
BACKEND_PORT="4100"
FRONTEND_PORT="8081"

cleanup() {
  if [[ -n "${BACKEND_PID}" ]]; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_SERVER_PID}" ]]; then
    kill "${FRONTEND_SERVER_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

is_port_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

cd "$BACKEND_DIR"
if is_port_listening "$BACKEND_PORT"; then
  echo "Backend gebruikt bestaande listener op poort $BACKEND_PORT."
else
  npm start &
  BACKEND_PID=$!
fi

cd "$FRONTEND_DIR"
npm run web:export

cd "$ROOT_DIR"
if is_port_listening "$FRONTEND_PORT"; then
  echo "Webserver gebruikt bestaande listener op poort $FRONTEND_PORT."
else
  python3 -m http.server "$FRONTEND_PORT" -d "$FRONTEND_DIR/dist" &
  FRONTEND_SERVER_PID=$!
fi

for _ in {1..15}; do
  if curl -sSf "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
    if command -v open >/dev/null 2>&1; then
      open "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1 || true
    fi
    break
  fi
  sleep 1
done

if [[ -n "${FRONTEND_SERVER_PID}" ]]; then
  wait "$FRONTEND_SERVER_PID"
fi
