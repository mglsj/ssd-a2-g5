# UI build plan

This is the build plan for the StaySpot front end in `web/`, written for a Claude Code session to follow phase by phase.
Each phase ends with checks. Do not start the next phase until they pass.

## Read first

1. `CLAUDE.md`: repo rules, the dev container, design tokens, skills.
2. `assignment 2.pdf` (extract with `pdftotext -layout`): Step 3 lists what each screen must do, "General expectations" lists loading, empty, error and phone layouts.
3. `docs/design/screens.md`: users, the 12 screens, routes, endpoints and the eight wireframes in `docs/design/wireframes/`.
4. `docs/api_endpoints.md`: request and response shapes and every error `code`. The live OpenAPI document is at `http://localhost:3000/api/docs`.
5. `DESIGN.md` and `web/src/routes/layout.css`: the look. Open `/design` in the dev server to see every token and component.

Use these skills while building: `svelte-code-writer` (run its autofixer on every `.svelte` and `.svelte.ts` file), `svelte-core-bestpractices`, `shadcn-svelte`, `tailwind-design-system`, `dataviz` (before any chart), and `web-design-guidelines` for the review in phase 9.

## What already exists

- **API** (`api/`): complete for every screen. It runs in the dev container on port 3000, published to the host. Start it with `cd api && bun run dev` inside the container.
- **Typed client**: `api/src/client.ts` exports `createClient(baseUrl)`, built on Hono's `hc`. It has been checked from `web/`:
  - `svelte-check` sees the real route types, so a wrong `sort` value or a wrong field type is a type error.
  - The Vite dev server serves the file to the browser.
- **Design system** (`web/`):
  - DESIGN.md tokens in `layout.css`, and `cn` and `tv` in `#lib/utils.js` with the merge config.
  - 12 shadcn components in `src/lib/components/shadcn`: badge, button, card, dialog, input, label, select, separator, skeleton, sonner, table, tabs.
  - `ModeWatcher` and `Toaster` are mounted in `+layout.svelte`.
- **Not yet done**:
  - Every product route.
  - The production build, because `svelte-adapter-bun@1.0.1` does not support SvelteKit 3 (phase 0 replaces it).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Rendering | SPA: `export const ssr = false` in `src/routes/+layout.ts`, built with `@sveltejs/adapter-static@4` and `fallback: "index.html"` | There is no auth and every page reads live API data, so SSR adds nothing. adapter-static supports SvelteKit 3. The API already serves a static build with an `index.html` fallback, so one process runs everything. |
| Build output | `pages: "dist"`, `assets: "dist"` | The API serves `web/dist` by default (`WEB_DIST`). `dist/` is already in the root `.gitignore`. |
| Dev wiring | Vite `server.proxy: { "/api": "http://localhost:3000" }` | Same origin in dev and production, so the client base URL is always `window.location.origin` and CORS never matters. |
| API calls | `createClient` from `../../api/src/client.ts`, wrapped once in `src/lib/api/` | Types come straight from the API's Zod schemas. Add `hono@^4.13.13` to `web` devDependencies so the build does not depend on `api/node_modules`. |
| Server state | `@tanstack/svelte-query@6` | Caching, loading and error states, retries and `refetchInterval` polling for the map, all with little code. |
| Map | `maplibre-gl@6` with `svelte-maplibre-gl@2`, basemap `https://tiles.openfreemap.org/styles/positron` | MapLibre is what the API's GeoJSON was shaped for. OpenFreeMap needs no API key. Positron is a quiet grey style that fits the warm canvas. |
| Charts | shadcn-svelte `chart` (LayerChart 2) | Already part of the component system. Colours come from `--chart-1` to `--chart-5`, which passed the colour checks. |
| URL state | Filters, sort, page and tab live in the query string (`$app/state` `page.url`, `goto(..., { replaceState: true, keepFocus: true, noScroll: true })`) | Back and forward work, links are shareable, and a reload keeps the view. |
| Actor | A `.svelte.ts` class with `role` and `guestId`, kept in `localStorage`, provided through context | This is the brief's demo switcher. Everything that needs "the current guest" reads it from one place. |

## Target layout

```
web/src/
  routes/
    +layout.ts                ssr = false
    +layout.svelte            QueryClientProvider, ModeWatcher, Toaster, AppShell
    +page.svelte              redirect: guest -> /properties, manager -> /analytics
    +error.svelte             friendly not-found and error page
    properties/+page.svelte
    properties/[id]/+page.svelte
    guests/+page.svelte
    guests/[id]/+page.svelte
    guests/[id]/wallet/+page.svelte
    bookings/+page.svelte
    bookings/[id]/+page.svelte
    analytics/+page.svelte
    map/+page.svelte
    reviews/+page.svelte
    design/+page.svelte       exists
  lib/
    api/client.ts             createClient(location.origin) and unwrap()
    api/errors.ts             ApiError class and messages per code
    api/queries.ts            query keys and query option factories per resource
    state/actor.svelte.ts     role, guestId, persisted
    format.ts                 rupees, dates, distances
    components/shadcn/        generated, do not hand-edit beyond theming
    components/app/           AppShell, ActorSwitcher, GuestPicker, PageHeader
    components/states/        LoadingState, EmptyState, ErrorState, QueryBoundary
    components/data/          DataTable, Pager, StatusBadge, Money, FilterBar
    features/<screen>/        components used by one screen only
```

## Rules that apply to every phase

- **Money** arrives as a string with two decimals. Format it with `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`. Do arithmetic on numbers only for display, never send a computed amount back.
- **Dates** in queries are UTC `YYYY-MM-DD`. Show timestamps in the viewer's local time zone with `Intl.DateTimeFormat("en-IN", ...)`.
- **Pages from the API** are `{ items, page, limit, total }`. Never fetch a whole table. The default limit is 20, at most 100.
- **Errors** are `{ error: { code, message, detail } }`. `unwrap()` throws an `ApiError` carrying all three. Show `message` as is, and use `code` to pick the title, icon and follow-up action (table below).
- **Every query-driven region** handles loading (Skeleton in the content's shape), empty (`Empty` component with a next step), error (`Alert` with Retry) and phone width. Put this in `QueryBoundary` once and reuse it.
- **Styling** follows `CLAUDE.md`:
  - Use semantic tokens only.
  - Blue is for actions and links.
  - Use `flex` and `gap-*`, not `space-y-*`.
  - Put `data-icon` on icons inside buttons.
  - Use the existing components before writing custom markup.
- Run `bun` commands for `web/` on the Windows host, not in the container.
- Do not commit unless asked.

| `code` | Title | Follow-up action |
|---|---|---|
| `INSUFFICIENT_BALANCE` | Not enough in the wallet | "Top up Rs X" with X = `detail.total_cost - detail.balance` |
| `ALREADY_CHECKED_IN` | Guest is already checked in | Link to `/bookings/{detail.active_booking_id}` |
| `INVALID_TRANSITION` | That status change is not allowed | Show `detail.from` and `detail.to` |
| `NOT_FOUND` | Not found | Back to the list |
| `BAD_REQUEST`, `INVALID_INPUT` | Check the form | Mark fields from `detail.issues[].path` |
| `DB_UNAVAILABLE` | A database is down | Retry, and the header banner from `/api/health` |
| `INTERNAL` | Something went wrong | Retry |

## Phase 0: tooling

1. Swap the adapter: remove `svelte-adapter-bun` and `@sveltejs/adapter-auto`, add `@sveltejs/adapter-static@^4`, and configure `pages`/`assets` as `dist` with `fallback: "index.html"` in `vite.config.ts`.
2. Add `src/routes/+layout.ts` with `export const ssr = false;`.
3. Add the Vite proxy for `/api`.
4. Add dependencies: `hono`, `@tanstack/svelte-query`, `maplibre-gl`, `svelte-maplibre-gl`.
5. Add shadcn components with `bunx --bun shadcn-svelte@latest add <names> --yes` from `web/`: `alert empty spinner field input-group pagination sheet toggle-group popover command dropdown-menu tooltip scroll-area chart avatar`. Read each added file. They pick up the theme automatically. If one uses `tv`, change its import to `#lib/utils.js`.

Checks:
- `bun run check` passes.
- `bun run build` writes `web/dist/index.html`.
- With the API running, `curl localhost:5173/api/health` returns `{"postgres":"ok","mongo":"ok"}`.

## Phase 1: app shell and shared pieces

Build `lib/api`, `lib/state/actor.svelte.ts`, `lib/format.ts`, the `states/` and `data/` components, then the shell.

- **AppShell**:
  - A white top bar on the warm canvas: wordmark, role-specific nav, role toggle (`ToggleGroup`), guest picker, and the wallet balance from `GET /guests/:id`.
  - Guest nav: Properties, Map, Reviews, My bookings, Wallet. Manager nav: Properties, Map, Reviews, Bookings, Guests, Analytics.
  - On phones the nav moves into a `Sheet`.
- **GuestPicker**: `Command` inside `Popover`, searching `GET /guests?q=` with a 250 ms debounce. Two quick picks: "Low balance guest" (`sort=balance_asc&limit=1`) and "Checked-in guest" (`has_active_stay=true&limit=1`).
- **Health banner**: poll `GET /api/health` every 30 s and show an `Alert` while either database is down.
- **`+error.svelte`** and the `/` redirect.

Checks:
- Switching role or guest updates the nav and balance without a reload, and survives a reload.
- The autofixer finds no issues.

## Phase 2: browse

| Screen | Route | Wireframe | Must do |
|---|---|---|---|
| Properties list | `/properties` | 1 | Search (debounced), min and max price, "Near IIIT" toggle that adds `lat`, `lng`, `radius` and allows `sort=distance`, sort select, card grid (1, 2 or 3 columns), `Pager`. Empty state with "Clear filters". |
| Property detail | `/properties/[id]` | 2 | Header with price and the `summary` numbers (label them "as of last refresh"). Catalog card that renders whatever fields the amenities document has: strings as lists, objects as key and value. Review facets for this property and the latest 3 reviews. Mini map. Leave room for the booking panel from phase 3. |
| Guests list | `/guests` | table pattern | Search, `sort`, `has_active_stay` filter, `DataTable` and `Pager`. Rows link to the guest. |
| Guest detail | `/guests/[id]` | card pattern | Balance, active stay, booking counts, latest audit row, the guest's bookings (`GET /bookings?guest_id`). Links to the wallet. |
| Bookings list | `/bookings` | 5 | Guest and property filters, status `ToggleGroup`, `DataTable` with `StatusBadge`, `Pager`. In guest mode it is "My bookings" with `guest_id` fixed. |
| Booking detail | `/bookings/[id]` | note on 5 | Booking facts and a status timeline (CONFIRMED, CHECKED_IN, COMPLETED). |

`DataTable` turns into stacked cards below the `md` breakpoint.

Checks:
- Every list survives page 1, a deep page, an empty filter result and the API being stopped.
- No list ever requests more than 100 rows.

## Phase 3: Workflow 1, booking and wallet

1. **Booking panel** on the property page (wireframe 2):
   - A nights stepper (1 to 365) and the live cost `base_price × nights`.
   - The current wallet balance.
   - A primary "Book for Rs X" button that calls `POST /bookings` with the actor's guest. Disabled with a hint when no guest is picked.
2. **Insufficient balance**: an inline `Alert` with the API message, plus "Top up Rs X" with X = cost minus balance. Re-fetch the guest to prove the balance did not change.
3. **Success** (wireframe 3): replace the panel with a result card showing:
   - the booking summary;
   - "Before" and "After" balances from the response;
   - the new `audit_log` row highlighted as "written by the trigger";
   - buttons "View booking" and "Open wallet".

   Invalidate the guest, bookings and audit queries.
4. **Top-up dialog**: amount `Input` (positive, two decimals), quick amounts, and `POST /guests/:id/top-up`. Show the CREDIT row it created. On a 422, show the overflow message.
5. **Wallet and audit trail** (`/guests/[id]/wallet`, wireframe 4):
   - Balance card with top-up.
   - From and To date inputs plus order, in the URL.
   - A summary line "Opening + rows = Closing".
   - An audit table with signed amounts and the running balance (`balance_after`), paged.
   - An empty-range state.

Checks:
- With the "Low balance guest" quick pick, a booking fails with the friendly message and the balance is unchanged.
- After a top-up the same booking succeeds, and the audit row's `balance_after` equals the new balance.

## Phase 4: statuses and the partial index

On the bookings list and booking detail:
- "Check in" on CONFIRMED rows and "Complete" on CHECKED_IN rows, both calling `PATCH /bookings/:id/status`.
- Show a `Spinner` in the button while the request runs.
- Update the row in place.
- Handle `ALREADY_CHECKED_IN` with a callout that links to the active stay (wireframe 5).
- Handle `INVALID_TRANSITION` with a toast.

Check:
- With the "Checked-in guest" quick pick, checking in a second CONFIRMED booking shows the callout, and its link opens the active stay.

## Phase 5: Workflow 2, analytics

`/analytics` (wireframe 6). Read the `dataviz` skill first.

1. **Summary tiles** from `GET /analytics/summary`, with "Summary refreshed {time}" and a "Refresh view" button (`POST /analytics/summary/refresh`, Spinner while running, then invalidate).
2. **Moving average line chart**: load `GET /analytics/moving-average` with no parameters first. It returns the top 5 and its `from` and `to`. Then let the user pick up to 5 properties (Command multi-select) and a date range.
   - Colours: `chart-1` to `chart-5` in series order.
   - A legend, direct labels on line ends, and a hover tooltip.
   - A "View as table" toggle.
3. **Ranking table** from `GET /analytics/rank` with an as-of date. Show the shared rank on ties and say so in a caption.
4. **Per-property summary table** below, sortable and paged.

Check:
- Complete a booking (phase 4), press Refresh, and the tiles change.

## Phase 6: Workflow 3, map

`/map` (wireframe 7). The API returns GeoJSON for MapLibre sources. See the map section of `docs/api_endpoints.md`.

- **Origin**: IIIT Hyderabad by default, a property from search, or a click on the map. Keep it in the URL as `lat` and `lng`.
- **Sources and layers**:

  | Source | URL | Layer |
  |---|---|---|
  | `area` | `/api/map/area` | fill at low opacity plus a dashed line in `--primary` |
  | `properties` | `/api/map/properties?lat&lng&radius=5000` | small symbols; `promoteId: "id"` |
  | `hotspots` | `/api/map/hotspots` | circles sized by `search_volume`, coloured by `hotspot_status`; numeric feature ids allow `setFeatureState` hover |
  | `pins` | `/api/map/pins` | small dots; `promoteId: "id"` |

- **Live pins**: load all pins once. Then every 5 s request `/api/map/pins?after={cursor}`, merge the new features by id, and keep the new `cursor`. Animate new ones briefly. Refetch hotspots every 10 s. Show "Live · updated N s ago" and pause polling when the tab is hidden.
- **Side panel**: the hotspot features in their returned order (nearest first), distance, volume and status. Hovering a row highlights the circle. On phones this panel becomes a bottom `Sheet`.
- **Drop a pin**: `POST /api/map/pins` with the actor's guest id, then add the returned feature to the pins source at once.
- **Density chart**: horizontal bars from `/api/map/density`.
- **Empty state**: "No searches in the last 2 hours", with the command to run the live seeder from `CLAUDE.md`.

Check:
- With `mongo_seeder.py --sessions 0 --live` running, new dots appear without a reload.

## Phase 7: Workflow 4, reviews

`/reviews` (wireframe 8).
- A scope select: all properties, or one property (Command search).
- **Facets** from `GET /reviews/analytics`:
  - overall average and sub-ratings as a stat tile;
  - the rating distribution as bars with percentages, all five stars always shown;
  - top tags as bars, and clicking a tag sets `tag` in the URL.
- A review list from `GET /reviews?tag&rating&property_id`, paged.
- A catalog-document card for the chosen property, reusing the phase 2 renderer.

Check:
- Clicking a tag filters the list, and the count matches that tag's frequency.

## Phase 8: polish

- **Phone widths** (375 px): no horizontal scroll. Tables become cards, and the map panel becomes a sheet.
- **Dark mode**: every screen reads well. Charts switch to the dark chart palette automatically through the tokens.
- **Accessibility**: real labels on every control, focus rings visible, and icon-only buttons with `aria-label`. Status is never shown by colour alone.
- **Page titles**: `<svelte:head><title>` on every route.
- Review the UI with the `web-design-guidelines` skill and fix what it finds.

## Phase 9: tests and docs

1. **Playwright** (`@playwright/test`) in `web/tests/`. These run against the dev server and the seeded databases:
   - a booking that fails for lack of balance and leaves the balance unchanged;
   - top up, then book, then see the audit row;
   - a second check-in blocked with the link to the active stay;
   - the map shows a dropped pin.
2. **Root `README.md`**:
   - how to run `web/` in dev and the single-process production mode (`bun run build` in `web/`, then the API serves `web/dist`);
   - tech choices with one-line reasons (copy the Decisions table);
   - screenshots of each screen;
   - the assumptions.
3. **`CLAUDE.md`**: add the web commands and any new gotchas.

## Definition of done

- All four workflows work end to end from the browser, and each failure the brief names shows a friendly message.
- Every list is paged, and every screen has its loading, empty and error states.
- `bun run check`, `bun run build`, the API's `bun test` and the Playwright tests all pass.
- The demo path works in order: switch to the low-balance guest, fail a booking, top up, book, open the wallet, switch to manager, check in twice, refresh analytics, watch the map, filter reviews by tag.
