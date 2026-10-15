#!/usr/bin/env bash
# Starts the API and the already built web app, and stops both on Ctrl+C.
# It installs and builds nothing: run scripts/build_and_run.sh first (or `bun run build` in web/).
# Needs PG_URI and MONGO_URI. Use API_PORT and WEB_PORT to change ports.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PG_URI:?set PG_URI, e.g. postgresql://postgres:postgres@localhost:5432/stayspot}"
: "${MONGO_URI:?set MONGO_URI, e.g. mongodb://localhost:27017/stayspot}"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-4173}"

[ -f web/build/index.js ] || { echo "web/build is missing. Run scripts/build_and_run.sh first." >&2; exit 1; }

pids=()
stop() {
  trap - INT TERM EXIT
  kill "${pids[@]}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap stop INT TERM EXIT

echo "== API on :$API_PORT"
(cd api && PORT="$API_PORT" exec bun run start) &
pids+=($!)

echo "== Web on :$WEB_PORT"
(cd web && API_URL="http://localhost:$API_PORT" PORT="$WEB_PORT" PROTOCOL_HEADER=x-forwarded-proto exec bun ./build) &
pids+=($!)

echo "Open http://localhost:$WEB_PORT (API docs at http://localhost:$API_PORT/api/docs). Ctrl+C stops both."
wait -n "${pids[@]}"
echo "A server exited, stopping the other."
