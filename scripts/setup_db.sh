#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PG_URI:?set PG_URI, e.g. postgresql://postgres:postgres@localhost:5432/stayspot}"
: "${MONGO_URI:?set MONGO_URI, e.g. mongodb://localhost:27017/stayspot}"

export PGOPTIONS="-c client_min_messages=warning"

echo "== PostgreSQL schema"
psql "$PG_URI" -q -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE" -c "CREATE SCHEMA public"
for f in sql/0*.sql; do
  echo "   $f"
  psql "$PG_URI" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done

echo "== PostgreSQL seed"
uv run --project data_generation python data_generation/postgres_seeder.py --uri "$PG_URI"

echo "== MongoDB collections and indexes"
mongosh "$MONGO_URI" --quiet mongo/01_collections_and_indexes.js >/dev/null

echo "== MongoDB seed"
uv run --project data_generation python data_generation/mongo_seeder.py --uri "$MONGO_URI" --pg-uri "$PG_URI" --seed-all

echo "== Done"
