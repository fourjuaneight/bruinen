# Bruinen — frontend for Rivendell

## Context

Rivendell (`~/Repos/rivendell`) is a PocketBase v0.40.6 catalog of 15 collections + a `meta` lookup table, reachable only on the tailnet. Today the only UIs are the PocketBase admin (`/_/`) and Datasette (read-only). Bruinen (`~/Repos/bruinen`, empty repo) is a lightweight, mobile-first app to **browse every collection, search/sort it, and add records through Rivendell's existing create endpoints**, including barcode scanning from the phone camera.

Decisions made with user:
- **Local app on the tailnet only** (Cloudflare Pages dropped). Own Tailscale node, same pattern as `rivendell-datasette`.
- **Auth: PocketBase superuser login** (email + password → server-side session cookie).
- **Framework: SvelteKit** (SSR, `adapter-node`).
- **Card view: every collection with a cover**: movies, shows, games, mtg (`image`), books, cds, vinyls.
- Scope is **read + create only**. No edit/delete (updates need meta IDs, not names; deletes are audited superuser actions in Rivendell).

## Architecture

```
phone/laptop on tailnet
   │ https://bruinen.<tailnet>.ts.net  (Tailscale Serve, real TLS → camera works)
   ▼
tailscale sidecar (hostname bruinen) ──► bruinen app (SvelteKit node, :3000)
                                              │ http://rivendell-app:8090
                                              │ (joins external docker network rivendell_internal)
                                              ▼
                                         Rivendell PocketBase
```

- The browser never calls PocketBase. Every request goes through SvelteKit `load` functions and form actions. The superuser token lives in an httpOnly, Secure, SameSite=Lax cookie and is never exposed to JS.
- `src/hooks.server.ts` creates a per-request `PocketBase` client (`POCKETBASE_URL` env) and loads the auth cookie into it. It redirects to `/login` when the token is invalid, and refreshes the cookie on the response.
- Cover images load directly from B2 URLs stored on records (`cover`, mtg `image`/`back`). **Check in milestone 1 that the bucket is public**; if it isn't, add a `/img` proxy route.

## Rivendell / PocketBase version check (v0.38.0 → v0.40.6)

Checked Rivendell commits `268a100..04d7275` and PocketBase `CHANGELOG.md` + `CHANGELOG_23_39.md`. **Nothing in the plan breaks.**
- Rivendell: schema, preparers, enrichers and access rules are unchanged. Only the `go.mod`/Go version bump and a `log.Fatal` format fix.
- PocketBase: no changes to the records list/create or `_superusers` auth-with-password REST APIs, filter syntax, or cookie/auth-token format.
- Things to account for:
  - **`SuperuserIPs` setting** (Settings → superuser IPs): if set, superuser requests from any other IP are rejected. Bruinen's server calls PocketBase from its container IP on `rivendell_internal`, so add that subnet to the list if you use it. Covered in the README and in milestone 1.
  - `Cross-Origin-Opener-Policy: same-origin` is now on PocketBase responses. No effect: the browser never loads PocketBase pages.
  - Go 1.27's `encoding/json/v2` (v0.40.0) is a Rivendell-side risk. The PocketBase author advises testing locally before trusting it in production. The milestone 1 smoke run against real Rivendell (login + list every collection) doubles as that check for the read path.
  - JS SDK: pin the `pocketbase` npm release whose compatibility table covers server v0.40.x.

## Stack

- SvelteKit 2 + Svelte 5, TypeScript, `@sveltejs/adapter-node`, Node 24 LTS
- `pocketbase` JS SDK (server-side only)
- Plain CSS with custom properties (light/dark tokens), no UI kit or Tailwind
- `barcode-detector` (zxing-wasm ponyfill). Uses the native `BarcodeDetector` when present (Android Chrome) and wasm otherwise (iOS Safari). Lazy-loaded only when the scanner opens.
- Vitest + `@testing-library/svelte` (unit/component); Playwright (e2e)

## Repo layout (key files)

```
src/
  hooks.server.ts                 per-request PB client, auth guard
  lib/collections.ts              ★ collection registry (single source of truth)
  lib/server/pb.ts                client factory, long-timeout fetch for creates
  lib/server/query.ts             search/sort/page → PB list params (pb.filter for escaping)
  lib/server/payload.ts           form data → create payload per registry
  lib/barcode.ts                  normalize/validate EAN-13, UPC-A, ISBN-10→13
  lib/components/
    DataTable.svelte              semantic <table>, aria-sort headers
    CardGrid.svelte               cover cards, lazy <img>, aspect-ratio boxes
    CreateDialog.svelte           native <dialog>, focus mgmt, progressive form
    FieldInput.svelte             renders a registry field (text/number/url/date/select/meta/tags/json)
    BarcodeScanner.svelte         getUserMedia + detector loop, torch toggle, manual fallback
    Toolbar.svelte                search box, view toggle, sort select (mobile)
    Pagination.svelte
  routes/
    login/+page.svelte, +page.server.ts     authWithPassword on _superusers, logout action
    +layout.server.ts                       collection nav + counts
    +page.svelte                            home: collection list
    [collection]/+page.server.ts            load (list) + actions.create
    [collection]/+page.svelte               table/cards + create dialog
    [collection]/[id]/+page.server.ts|svelte  record detail (all fields, archive links)
tests/e2e/                        Playwright specs + mock PocketBase server
Dockerfile, docker-compose.yml, serve.json (gitignored), .env.example
```

## Collection registry (`src/lib/collections.ts`)

One typed entry per collection, derived from `rivendell/schema/collections.go` and `docs/API.md`. Everything else reads from it.

```ts
{
  name: 'movies', label: 'Movies',
  titleField: 'title',            // mirrors recordLabel() in rivendell/enrichers.go
  image: 'cover',                 // undefined → table only; mtg → 'image'
  columns: ['title','director','year','genre','definition','status','favorite'],
  searchFields: ['title','director'],
  sortable: ['title','year','created'], defaultSort: '-created',
  expand: ['genre','definition','status'],   // show meta names, not IDs
  create: [                        // only the "Send" fields from API.md
    { name:'title', type:'text', required:true },
    { name:'director', type:'text' },
    { name:'barcode', type:'text', scan:true },
    { name:'genre', type:'meta', metaType:'genre' },
    { name:'definition', type:'meta', metaType:'definition' },
    { name:'status', type:'meta', metaType:'status' },
    { name:'year', type:'number' }, { name:'comments', type:'textarea' },
  ],
  slowCreate: false,              // true for articles/podcasts/videos (B2 archiving)
}
```

Rules taken from Rivendell:
- Meta fields: options come from `meta` filtered by `type`. The **name** is sent, not the ID, because the preparers resolve names on create. Tags are a multi-select capped at 5.
- Hide fields Rivendell fills in: `cover`, `archive`, `dead`, `shared`, enriched `year` (still optional where API.md allows it).
- Scan targets: books → `isbn`; cds, vinyls, games, movies, shows → `barcode`.
- `records.stack` is a JSON array, entered as comma-separated chips. `start`/`end` are date inputs.

## Features

**Browse.** `/[collection]?q=&sort=&page=&view=table|cards`. All state lives in the URL, so it's SSR'd, shareable, and works with back/forward. The list uses `expand` for meta names. 30 items per page.

**Search.** Debounced input submits the GET form. The server builds `searchFields.map(f => f ~ {:q}).join(' || ')` through `pb.filter()` for escaping. Tag search uses `tags.name ~ {:q}`, which Rivendell's open meta relations support.

**Sort.** Clickable `<th>` buttons with `aria-sort` on desktop, a `<select>` on mobile. Only `sortable` fields from the registry are allowed; the server rejects anything else.

**Table and cards.** On mobile the table becomes stacked label/value rows (CSS only, no second markup). Cards show a fixed 2:3 frame (mtg 63:88), `loading="lazy"`, alt text from the title, and a placeholder when there's no cover. Collections with images default to cards on narrow screens.

**Create dialog.** A native `<dialog>` with focus returned on close and Esc to close. It uses `use:enhance`, so it works without JS as a plain page fallback. PocketBase validation errors (`data.{field}.message`) map to field errors, and prepare errors (unknown tag) show as a form-level error.
- Slow creates: the submit button turns into "Archiving… this can take a few minutes" and double submits are blocked. The server uses a fetch with a 10-minute timeout, since undici's default headersTimeout is 300s and video archiving can be longer. If it times out: "Still processing in Rivendell — refresh later". Rivendell keeps enriching after the client goes away.
- On success: close the dialog, invalidate the list, and show a toast linking to the new record.

**Barcode scanner.** A button next to the scan-target field opens the camera (`facingMode: 'environment'`), with a torch toggle when supported. The detector polls each frame. On the first valid code it vibrates, fills the field and closes. Camera permission denied or no camera → message plus manual entry. HTTPS comes from Tailscale Serve, so `getUserMedia` is allowed.

**Login.** Email and password are checked with `pb.collection('_superusers').authWithPassword` on the server and written to the cookie with `exportToCookie({ httpOnly: true, secure: true, sameSite: 'Lax' })`. Logout is a form action that clears the cookie. If PocketBase asks for MFA/OTP, show a clear message (out of scope for v1).

**Accessibility and mobile-first.** Base styles target about 360px and scale up with min-width queries. Touch targets are at least 44px. A skip link, visible focus, labelled inputs, `aria-live` for toast and loading states, and `prefers-reduced-motion` and `prefers-color-scheme` support. AA contrast checked in e2e with `@axe-core/playwright`.

## Deployment

- `Dockerfile`: multi-stage build (`node:24-alpine`, `npm ci && npm run build`, then a runtime stage with `build/` and production deps). Runs as a non-root user.
- `docker-compose.yml`: `tailscale` sidecar (hostname `bruinen`, `TS_SERVE_CONFIG`, auth key `TS_AUTHKEY`, state on `<PATH>/bruinen/tailscale`, matching Rivendell's volume pattern) + `app`. The `app` service joins the external network `rivendell_internal`. Env: `POCKETBASE_URL=http://rivendell-app:8090`, `ORIGIN=https://bruinen.<tailnet>.ts.net` (needed for adapter-node CSRF on form actions).
- Use the `anthropic-skills:homelab-compose` skill when writing compose and `serve.json` so they match the established sidecar conventions.
- `.env.example` documents the variables. `.env` and `serve.json` are gitignored.

## Testing

- **Unit (Vitest):** registry consistency against a JSON fixture of Rivendell's schema (every create field exists, required flags match); `query.ts` (filter escaping, sort allowlist, page bounds); `payload.ts` (meta names passed through, tags array, empty optionals dropped, JSON `stack`); `barcode.ts` (check digits, ISBN-10→13, UPC-A→EAN-13).
- **Component (Testing Library):** DataTable `aria-sort` and sorting links; CreateDialog field errors and pending state; BarcodeScanner with an injected fake detector (permission denied, then a detected code fills the field).
- **E2E (Playwright, Chromium + WebKit mobile viewport):** against a **mock PocketBase** (`tests/e2e/mock-pb.ts`, a small Node server for `_superusers` auth-with-password, `records` list/create, `meta` list, with seeded fixtures and an optional delay to simulate slow creates). No calls to real external APIs or Rivendell. Specs:
  - login (bad and good credentials)
  - redirect when logged out
  - browse, search, sort, paginate
  - table/cards toggle
  - create book with meta names, then the record appears
  - unknown tag error shown
  - slow create shows pending state
  - scan via Chromium fake camera (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=tests/e2e/fixtures/ean13.y4m`)
  - axe scan per page
- One optional smoke spec (`E2E_REAL_PB=1`) to run by hand against the real tailnet Rivendell: login + list only, no creates.

## Implementation order

0. Commit the design as `docs/superpowers/specs/2026-11-18-bruinen-frontend-design.md`, then write the detailed task plan (superpowers:writing-plans).
1. Scaffold SvelteKit (TS, adapter-node, Vitest, Playwright, ESLint/Prettier). Write `pb.ts` and the login flow. **Check that B2 cover URLs load publicly.**
2. Collection registry + schema fixture + unit tests.
3. Browse: list load, DataTable, search/sort/pagination, URL state, mobile layout.
4. CardGrid + view toggle + record detail page.
5. CreateDialog + payload mapping + error mapping + slow-create handling.
6. BarcodeScanner + barcode utils.
7. Mock PB + full e2e suite + axe.
8. Dockerfile, compose, serve.json example, README. Deploy on the Docker host.

## Verification

- `npm run check && npm run test:unit && npm run test:e2e` all green.
- `npm run dev` with `POCKETBASE_URL` pointed at the tailnet Rivendell (`https://rivendell.<tailnet>.ts.net`): log in, browse each of the 15 collections + meta, confirm meta names render and covers load.
- Create a test record you're happy to keep, e.g. a `read_later` entry, which has no enrichment. Bruinen can't delete it; you'd remove it yourself in the PocketBase admin.
- `docker compose up --build`, open `https://bruinen.<tailnet>.ts.net` on a phone, scan a real book ISBN in the create dialog, and confirm the field fills.

## Out of scope (v1)

Editing and deleting records, MFA/OTP login, offline/PWA, realtime updates, analytics (Datasette covers it).
