#!/usr/bin/env bash
# Rewrites the README screenshots in docs/design/screenshots from the running app.
# Needs the API on :3000 and live map pins. Run on the host, where web/node_modules lives.
set -euo pipefail
cd "$(dirname "$0")/../web"

mkdir -p ../docs/design/screenshots
SCREENSHOTS=1 bunx playwright test tests/screenshots.spec.ts
