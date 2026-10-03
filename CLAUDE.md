# CLAUDE.md

StaySpot (Project 3), a vacation rental database for CS6.302 Software System Development at IIIT Hyderabad.
Assignment 1 (PostgreSQL + MongoDB, inherited from another team) is done and fixed. Assignment 2 adds a server layer in `api/` and a web front end in `web/`.
The briefs are `assignment 1.pdf` and `assignment 2.pdf` at the repo root. Extract them with `pdftotext -layout`.
`docs/handover_note.md` lists every change we made to the inherited code and why.

## Layout rules

- The Assignment 1 folders keep exactly their required files. Do not add files to `sql/`, `mongo/` or `performance/`. `data_generation/` may only add the uv project files (`pyproject.toml`, `uv.lock`).
- Assignment 2 adds `api/`, `web/`, `docs/api_endpoints.md` and `docs/design/`. Helper scripts go in `scripts/`.
- There is no `<team>_a1b/` top folder. A zip script adds it at submission time.
- The root `README.md` is the Assignment 2 README. The original Assignment 1 README is `docs/README_a1.md`.
- Every change to inherited code must be recorded in `docs/handover_note.md` (Assignment 2 requires it).

## Running things

The dev container (`.devcontainer/`) runs PostgreSQL 18, MongoDB 8 and a devenv shell with uv, psql and mongosh. It sets `PG_URI` and `MONGO_URI` (database `stayspot`).

```bash
bash scripts/setup_db.sh                 # drop schema, run sql/0*.sql, seed both databases (about 40 s)
bash scripts/regenerate_performance.sh   # rewrite both files in performance/
uv run --project data_generation python data_generation/mongo_seeder.py --sessions 0 --live   # fresh map pins
```

From the Windows host, run commands inside the container with
`MSYS_NO_PATHCONV=1 docker exec -w /workspace ssd_a2_devcontainer-app-1 devenv shell -- bash -c '...'`.
Plain `docker exec` without `devenv shell` misses `LD_LIBRARY_PATH` and `UV_PROJECT_ENVIRONMENT`, so psycopg2 fails to import and uv creates a stray `data_generation/.venv`.

## Database behaviour worth knowing

- `sp_execute_booking(guest, property, nights, OUT ...)` prices a stay as `base_price * nights` and raises a named error on failure. `CALL` needs `NULL` for each OUT parameter.
- `sp_update_booking_status` allows only CONFIRMED to CHECKED_IN to COMPLETED. A second check-in fails on the partial unique index `idx_active_stay`, which is how the UI demonstrates it.
- `wallet_audit_logs` is append-only (a trigger blocks UPDATE and DELETE). The audit trigger uses `clock_timestamp()`, not `NOW()`, so the procedures can find their row with `ORDER BY timestamp DESC LIMIT 1`.
- Workflow 2 is `fn_property_moving_avg` and `fn_property_revenue_rank` in `sql/06_window_analytics.sql`. They are plain SQL functions so the planner inlines them and EXPLAIN shows the real plan.
- `mongo/02_workflow3_geonear.js` and `03_workflow4_facet.js` run the workflow under mongosh and export their pipeline builders when loaded with `require()` from Node. The API must reuse those builders.
- With `mongosh --quiet --eval "var EXPLAIN = true" -f <script>` a workflow prints only its explain output as JSON. Use `var EXPLAIN = true`, not `EXPLAIN=true`, which echoes `true` into the output.
- `SearchSessions` has a 2-hour TTL, so seeded pins vanish two hours after seeding. Workflow 3 defaults to IIIT Hyderabad (17.4455, 78.3489).

## Seed data

- Everything is set in Hyderabad, with rupee amounts and Faker's `en_IN` locale.
- `postgres_seeder.py` holds `LOCALITIES` (32 weighted localities) and `TRIVAGO_LISTINGS` (209 real listings from trivago searches around IIIT). `mongo_seeder.py` imports both.
- After changing seed logic, check that every guest's `wallet_balance` equals their latest `balance_after` and that no guest has two CHECKED_IN bookings.

## Conventions

- Write prose (docs, comments, commit messages) in plain language: no em dashes, sentence-case headings, active voice, short sentences.
- Keep comments sparse. The SQL files carry almost none.
- Python uses builtin generics (`list[str]`, `X | None`), not the `typing` module, and targets Python 3.13+.
- All text files use LF line endings in git (`.gitattributes` sets `* text=auto eol=lf`). Write new and edited files with LF.
- When patching MongoDB pipelines with a JavaScript `String.replace`, pass the replacement as a function. A string replacement turns `$$var` into `$var`.
- Do not commit unless asked.

## Skills and MCP servers

devenv generates `.mcp.json` and `.claude/settings.json` from `claude.code.enable = true` in `devenv.nix`. Both are symlinks into the container's Nix store, so they only resolve inside the container. Do not edit them. Change `devenv.nix` instead.

`.claude/skills/` holds skills installed from GitHub. `skills-lock.json` records each source and hash.

| Skill | Use it for |
| --- | --- |
| `postgres` | Postgres query tuning, connection problems and EXPLAIN reading (`sql/`, `performance/`) |
| `mongodb-query-optimizer` | Index and slow-query help for the Workflow 3 and 4 pipelines (`mongo/`) |
| `mongodb-schema-design` | Embed versus reference choices, TTL and schema validation (`mongo/`) |
| `typescript-advanced-types` | Generics and type utilities in `web/` |
| `tailwind-design-system` | Tailwind v4 tokens and components in `web/` |
| `web-design-guidelines` | Review UI code for accessibility and UX (`web/`) |
| `writing-guidelines` | Review prose in `docs/` and `README.md` |

The `mongodb-*` skills say to use the MongoDB MCP server when one is available. None is configured here, so run `mongosh` against `MONGO_URI` instead.

MCP servers:

- `mcp.devenv.sh` (HTTP, `https://mcp.devenv.sh`) answers questions about devenv options and `devenv.nix` syntax. Use it before guessing at devenv config.
