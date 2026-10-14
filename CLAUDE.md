# CLAUDE.md

StaySpot (Project 3), a vacation rental database for CS6.302 Software System Development at IIIT Hyderabad.
Assignment 1 (PostgreSQL + MongoDB, inherited from another team) is done and fixed. Assignment 2 adds a server layer in `api/` and a web front end in `web/`.
The briefs are `assignment 1.pdf` and `assignment 2.pdf` at the repo root. Extract them with `pdftotext -layout`.
`docs/handover_note.md` lists every change we made to the inherited code and why.

## Layout rules

- The Assignment 1 folders keep exactly their required files. Do not add files to `sql/`, `mongo/` or `performance/`. `data_generation/` may only add the uv project files (`pyproject.toml`, `uv.lock`) and `data.py`.
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
cd api && bun run dev                    # API on :3000, docs at /api/docs
cd api && bun run typecheck && bun test  # tests hit the seeded databases and add a few rows
```

## API

- Bun, Hono and `@hono/zod-openapi`. Code is grouped by feature in `api/src/modules/<feature>/` with `schemas`, `repository`, `routes`, `handlers` and `index.ts` files (see `api/README.md`). Queries live only in repositories. `api/src/shared/errors/to-api-error.ts` maps SQLSTATE codes to the error codes in `docs/api_endpoints.md`.
- PostgreSQL goes through `Bun.sql` with no ORM. Bun decodes a zero NUMERIC from a parameterised query as `"0"`, so queries cast money columns to `::text` and procedure OUT values go through `money()`.
- The `mongodb` driver stays on v6. v7's `bson` does not load on Bun 1.3.
- Map endpoints under `/api/map` return GeoJSON (`application/geo+json`) for MapLibre sources: `[lng, lat]`, flat feature properties, a top-level `id` on every feature. Declare them with `geoJson()` from `shared/openapi.ts`. Density is chart data and stays plain JSON.
- Build `Bun.sql` fragments inside a function (`const where = () => sql\`...\``) when a query uses them twice, rather than sharing one fragment object.
- `src/client.ts` exports a typed `hc` client from `AppType`. `test/client.test.ts` breaks the type check if route types stop flowing through.

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
- `postgres_seeder.py` holds `LOCALITIES` (32 weighted localities). `data.py` holds `TRIVAGO_LISTINGS` (1,000 real listings from trivago searches across Hyderabad, centred on IIIT). Both seeders import from there.
- Both seeders insert with thread pools. Postgres loads `bookings` and `wallet_audit_logs` in parallel after the parent tables commit. Mongo keeps document generation on the main thread so the seed stays reproducible.
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
| `mongodb-query-optimizer` | Index and slow-query help for the Workflow 3 and 4 pipelines (`mongo/`). Listed in the lock file but not installed in `.claude/skills/` yet. |
| `mongodb-schema-design` | Embed versus reference choices, TTL and schema validation (`mongo/`). Same: locked but not installed. |
| `svelte-code-writer` | Svelte 5 docs lookup and code analysis. Use it for every `.svelte` and `.svelte.ts` edit in `web/`. |
| `svelte-core-bestpractices` | Runes, events, styling and library integration in `web/` |
| `shadcn-svelte` | Add, update and compose shadcn-svelte components in `web/` (`components.json`, ui path `#lib/components/shadcn`) |
| `typescript-advanced-types` | Generics and type utilities in `web/` and `api/` |
| `tailwind-design-system` | Tailwind v4 tokens and components in `web/` |
| `web-design-guidelines` | Review UI code for accessibility and UX (`web/`) |
| `writing-guidelines` | Review prose in `docs/` and `README.md` |

The `mongodb-*` skills say to use the MongoDB MCP server when one is available. None is configured here, so run `mongosh` against `MONGO_URI` instead.

`web/` is SvelteKit 3 with Svelte 5, Tailwind v4, shadcn-svelte (style `vega`, Lucide icons) and `svelte-adapter-bun`. Run `bun run check` there for type and Svelte checks.

- The look comes from `DESIGN.md` at the repo root. Its tokens live in `web/src/routes/layout.css` as shadcn variables plus `text-display-1` … `text-eyebrow`, `shadow-soft`, `shadow-elevated` and the `--radius-*` scale. `/design` shows every token and component.
- Use semantic tokens (`bg-primary`, `text-link`, `text-muted-foreground`). Blue is for actions and links only. `chart-1` … `chart-5` passed the dataviz validator in both modes, so keep their order.
- Import `cn` and `tv` from `#lib/utils.js`, never straight from `cn` or `tailwind-variants`. Both carry a merge config for the custom type scale. Without it they drop `text-heading-3` when a colour class sits next to it.
- `web/node_modules` holds Windows binaries, so run `bun` commands in `web/` on the host, not in the container.

MCP servers in `.mcp.json`:

- `mcp.devenv.sh` (HTTP, `https://mcp.devenv.sh`) answers questions about devenv options and `devenv.nix` syntax. Use it before guessing at devenv config.
- `bun.com` (HTTP, `https://bun.com/docs/mcp`) searches the Bun docs, guides and blog. Use it for `Bun.sql`, `bun test` and Hono-on-Bun questions before guessing.

Not in `.mcp.json`: the trivago connector is attached to the Claude app, not the project. Use its radius search to refresh `data_generation/data.py`. One call returns about 25 hotels, so cover Hyderabad with a grid of points and star-rating filters, then dedupe by name and coordinates.
