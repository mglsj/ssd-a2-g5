#!/usr/bin/env bash
set -e

if ! command -v uv >/dev/null 2>&1; then
  if [ -n "$DEVENV_REENTERED" ]; then
    echo "uv is not available even inside 'devenv shell'. Check devenv.nix."
    exit 1
  fi
  echo "uv not on PATH; re-entering under devenv shell..."
  export DEVENV_REENTERED=1
  exec devenv shell -- bash "$0" "$@"
fi

if [ -f "data_generation/pyproject.toml" ]; then
  (
    cd data_generation
    uv sync

    uv run python -c "import uuid, psycopg2, pymongo, faker" \
      || { echo "Python environment is broken; check languages.python in devenv.nix."; exit 1; }
  )
fi

echo ""
echo "Dev container ready."
echo "PostgreSQL: \$PG_URI    = $PG_URI"
echo "MongoDB:    \$MONGO_URI = $MONGO_URI"
