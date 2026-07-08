# HAView

A fast, self-hosted dashboard for Home Assistant — built for wall-mounted displays and
phones. Static Preact + TypeScript app that talks directly to HA's WebSocket and REST
APIs; no backend.

## Features

- **User-defined pages** — the navigation is yours: add, rename, re-icon, and reorder
  pages in Settings. Each page is a 12-column grid you lay out yourself: tap the ✎
  button, then drag, resize (snap-to-grid), and delete elements freely. Layouts persist
  per device and travel via Settings → Export/Import.
- **Any HA entity as a card** — the Add dialog browses every entity grouped by HA Area,
  searchable by name/id and filterable by HA Labels. Cards adapt to capabilities:
  on/off-only lights toggle, dimmable/color lights get brightness, color-temperature and
  color controls; climate gets target temp + HVAC modes; media players get transport +
  volume; scenes/scripts/buttons fire on tap; sensors display live values.
- **Widgets** — week calendar (configurable HA calendars), weather, family presence,
  history graphs / compact stat tiles, an alert ribbon, and cameras — placeable on any page
- **Stat tiles & graphs** — any sensor as a full history chart or a compact icon + value +
  sparkline tile
- **Themes** — five accent themes (Oranje default) + light/dark/auto, in Settings

Dark theme by default (light follows the OS setting), bottom tabs on phones, sidebar on
wide screens (pages stack single-column on narrow screens). Auto-reconnects forever —
built to survive HA restarts and network drops without a reload.

## Architecture: one container, shared config

The container is a small **Node server** that (1) serves the built SPA, (2) **reverse-
proxies Home Assistant** at `/ha` (WebSocket + REST + camera media) injecting the token
server-side, and (3) stores config **profiles** in a `/data` volume. Consequences:

- The HA URL + token are entered **once** and live only in the container — never in any
  browser. Open the dashboard from any screen with no per-device setup.
- **No HA CORS configuration** is needed (browsers talk only to the dashboard, same-origin).
- **Profiles** (full layouts) are shared across devices; each screen picks which one it
  shows (Settings → Profiles), starting from a couple of built-in templates.

## Development

```bash
npm install
npm run dev        # SPA dev server (Vite)
```

For the dev server to reach HA you'd need the Node server + proxy running too; day-to-day
UI work is done against the deployed container. See
[docs/ha-setup.md](docs/ha-setup.md) for the (now minimal) Home Assistant setup.

## Deploy (GitHub → unraid)

Every push to `main` runs [the CI workflow](.github/workflows/build.yml): it type-checks
and builds the SPA, then builds and publishes the image to GitHub Container Registry as
`ghcr.io/<owner>/<repo>:latest`.

On unraid, add a container from that image (Docker tab → Add Container):

- **Repository**: `ghcr.io/<owner>/<repo>:latest`
- **Port**: host `8090` → container `80`
- **Path**: host `/mnt/user/appdata/haview` → container `/data` (stores the HA
  connection + config profiles; **required** for shared/persistent config)

First load shows a setup screen — enter the HA URL + token once. Updating = push to GitHub,
then re-pull the image on unraid. If the repo/package is private, add a registry login on
unraid (`docker login ghcr.io` with a `read:packages` token).

**Once this is reachable from the public internet, it requires Google sign-in** —
restricted to an explicit allow-list of Google account emails you configure. See
[docs/google-auth-setup.md](docs/google-auth-setup.md) for the five env vars this needs;
without them the server fails closed (shows a "not configured" page) rather than running
open.

Or build from source on any Docker host:

```bash
docker compose -f deploy/docker-compose.yml up -d --build   # serves on :8090, /data volume
```

## Adding an element type

Pages and navigation are user data (settings v3, stored server-side as config profiles and
cached in `localStorage` under `haview.settings.v3`), so there is nothing to code for a
new page. To add a new placeable element type:

1. Create the component (see `src/elements/EntityCard.tsx` for the entity card, or the
   widgets under `src/views/main/`). It receives `{ pageId, element, editing }` props
   (`element.options` holds per-instance config) — or no props at all.
2. Add one entry to `elementDefs` in `src/grid/elements.ts` (type, title, module-level
   `load` import, default/min size).

Code splitting follows automatically. Use the data layer in `src/lib/ha/`:

- `useEntity(id)` / `useEntitiesByDomain(domain)` — live entity signals (fine-grained;
  only components reading a changed entity re-render)
- `callSvc(domain, service, data, target)` — fire HA service calls
- `ensureRegistries()` + `areas/devices/entityEntries/labels` signals — HA registries,
  loaded lazily (only the Add-element picker needs them)
- `haFetch(path)` — REST through the proxy (token injected server-side)
- `getSignedUrl(path)` — signed media URLs through the proxy (`<img>`-safe)

All HA access is same-origin via `haBase()` (`/ha`); the token is never in the browser.

## Architecture notes

- `server/` — Node runtime: `static.mjs` (SPA), `ha-proxy.mjs` (WS + REST reverse proxy;
  the WS proxy owns the HA auth handshake and hides the token), `api.mjs` + `config-store.mjs`
  (`/config/connection` and `/config/profiles`, persisted to `/data`), `templates/`.
- `src/lib/ha/connection.ts` — single WebSocket to `/ha`, retries forever, exposes a
  `connectionStatus` signal
- No router library: `location.hash` ↔ `currentRoute` signal; Shell resolves the route
  against `settings.pages` (unknown routes fall back to the first page)
- No grid library: drag/resize is hand-rolled on pointer events with pointer capture;
  positions are `{x, y, w, h}` grid cells (24 columns, 28px rows), free placement with
  collision-blocked drops
- `hls.js` is only loaded (as its own chunk) when a stream needs the HLS fallback; live
  view prefers WebRTC
- Camera snapshots are staggered and pause while the tab is hidden or HA is unreachable
