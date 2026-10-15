#!/usr/bin/env bash
# Installs missing dependencies, checks the API, builds the web app, then starts both and stops them on Ctrl+C.
# For a start without any of that, use scripts/run_all.sh.
# Needs PG_URI and MONGO_URI. Use API_PORT and WEB_PORT to change ports. Run it where both
# `api/node_modules` and `web/node_modules` work.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PG_URI:?set PG_URI, e.g. postgresql://postgres:postgres@localhost:5432/stayspot}"
: "${MONGO_URI:?set MONGO_URI, e.g. mongodb://localhost:27017/stayspot}"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-4173}"

for dir in api web; do
  [ -d "$dir/node_modules" ] || (echo "== bun install ($dir)" && cd "$dir" && bun install)
done

echo "== API typecheck"
(cd api && bun run typecheck)

echo "== Web build"
(cd web && bun run build)

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
