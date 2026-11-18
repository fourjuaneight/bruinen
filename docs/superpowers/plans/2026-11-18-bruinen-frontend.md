# Bruinen Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first SvelteKit app, on the tailnet only, for browsing, searching, sorting and adding records to Rivendell's PocketBase, with cover cards and camera barcode scanning.

**Architecture:** SvelteKit 3 SSR on `adapter-node`. Every PocketBase call happens server-side through a per-request SDK client authenticated by an httpOnly superuser cookie. The browser never talks to PocketBase. A single collection registry drives columns, search, sort, cards and create forms. E2E runs against an in-memory mock PocketBase.

**Tech Stack:** Node 24, SvelteKit 3.3 + Svelte 5.58 (TS 6, Vite 8), `@sveltejs/adapter-node` 6, `pocketbase` SDK 0.29.0, `barcode-detector` 3.2, `undici` (long-timeout dispatcher), Vitest 5 (node + browser projects, `vitest-browser-svelte`), Playwright 1.65, `@axe-core/playwright` 4.14, `bwip-js` (test fixture only).

**Spec:** `docs/superpowers/specs/2026-11-18-bruinen-frontend-design.md`

## Spec corrections (verified while planning; these override the spec)

1. **SvelteKit 3, not 2.** Config lives in `vite.config.ts` (no `svelte.config.js`). `$lib` is now `#lib` (a Node subpath import, with file extension). `$app/stores` is removed; use `$app/state`. `invalidateAll` is replaced by `refreshAll`. Hook types come from `@sveltejs/kit/hooks`. adapter-node no longer reads the `ORIGIN` env var; use the `paths.origin` config. Cookie `path` defaults to `/`.
2. **No `created`/`updated` fields exist** on any Rivendell data collection (live `_collections` checked; Rivendell's SCHEMA.md is wrong). Default sort is `-@rowid` (PocketBase's built-in rowid sort). `records` defaults to `-start`.
3. **Hook errors are opaque.** PocketBase turns a non-API error from a hook into `400 {"message":"Something went wrong while processing your request.","data":{}}`. An unknown tag can't be shown by name. The UI prevents it instead: meta fields are selects populated from `meta`.
4. **An enrich failure still saves the record.** Rivendell calls `e.Next()` (the save) before enriching. A generic 400 can therefore mean "rejected" or "saved without enrichment". After a generic 400, the create action looks the record up by its key field and reports which one happened.
5. Component tests use Vitest browser mode with `vitest-browser-svelte` (the `sv` scaffold default), not `@testing-library/svelte`.
6. Home page shows counts (one request per collection). The layout does not, to avoid 16 requests per navigation.
7. UPC-A barcodes are stored as scanned (12 digits), not converted to EAN-13; Discogs matches printed barcodes. Music cards are 1:1, mtg 63:88, everything else 2:3.

## Global Constraints

- Node ≥ 22.17 (use 24). TypeScript 6. Pin exact dependency versions in `package.json`.
- `pocketbase` SDK is only imported under `src/lib/server/` or `*.server.ts` / `hooks.server.ts`.
- Every server-side PocketBase client calls `pb.autoCancellation(false)` (the SDK otherwise cancels parallel same-collection requests).
- Auth cookie: name `pb_auth`, `httpOnly: true`, `sameSite: 'Lax'`, `path: '/'`, `secure: event.url.protocol === 'https:'`.
- Read + create only. No update or delete calls anywhere.
- Meta relation inputs submit **names**, never IDs. Tags max 5.
- 30 records per page.
- Slow-create timeout: 600 000 ms. Timeout copy: `Still processing in Rivendell — refresh later`. Slow-create button copy: `Archiving… this can take a few minutes`.
- Touch targets ≥ 44px. Base layout at 360px wide. Light and dark via `prefers-color-scheme`. `prefers-reduced-motion` respected. axe: zero violations.
- Server env: `POCKETBASE_URL` (default `http://127.0.0.1:8090`). Build env: `ORIGIN` → `paths.origin`.

## Review Focus

1. **Cover URL missing or 404** (enrich failed, B2 object gone) → card shows the placeholder, never a broken-image icon. Test in Task 6.
2. **Cookie present but token revoked/garbage** → redirect to `/login?next=…`, never a 500. Test in Task 3.
3. **Rivendell unreachable** (container down, data drive not mounted) → 503 page saying `Rivendell is unreachable`, no stack trace. Test in Task 3 (`toHttpError`) and Task 5 e2e.
4. **Search text with quotes or operators** (`O'Brien`, `"`, `|| id != ''`) → escaped by `pb.filter`, results not a 400. Test in Task 4 and Task 5 e2e.
5. **Garbage URL params** (`page=abc`, `page=-3`, `page=999`, `sort=password`, `view=x`) → clamped to defaults, empty-state with a "first page" link when past the end. Test in Task 4.

---

## File structure

```
vite.config.ts                       sveltekit({ adapter, paths.origin }) + vitest projects
package.json                         "imports": { "#lib/*": "./src/lib/*" }
src/app.d.ts                         App.Locals { pb, user }
src/app.css                          tokens (light/dark), base, utilities
src/hooks.server.ts                  handle (pb client + guard), handleError
src/lib/collections.ts               registry (types + COLLECTIONS + getCollection)
src/lib/barcode.ts                   check digits, ISBN normalize, normalizeScan
src/lib/server/config.ts             pocketbaseUrl()
src/lib/server/pb.ts                 createPb, AUTH_COOKIE, longFetch, toHttpError
src/lib/server/auth.ts               safeNext, cookieOptions
src/lib/server/query.ts              parseListQuery, buildListOptions, PER_PAGE
src/lib/server/payload.ts            buildPayload, mapPbError
src/lib/server/create.ts             createRecord (timeout + saved-without-enrich detection)
src/lib/components/*.svelte          DataTable, CardGrid, Toolbar, Pagination, CreateDialog, FieldInput, BarcodeScanner, Toast
src/routes/+layout.svelte, +layout.server.ts, +error.svelte
src/routes/+page.svelte, +page.server.ts                 home + counts
src/routes/login/+page.svelte, +page.server.ts
src/routes/logout/+page.server.ts                        POST action only
src/routes/[collection]/+page.svelte, +page.server.ts
src/routes/[collection]/[id]/+page.svelte, +page.server.ts
tests/fixtures/rivendell-schema.json                     collection → fields {name,type,required}
tests/e2e/mock-pb/server.ts, seed.ts                     in-memory PocketBase
tests/e2e/fixtures/ean13.y4m, make-barcode-video.ts
tests/e2e/*.spec.ts
playwright.config.ts
Dockerfile, docker-compose.yml, serve.json.example, .env.example, README.md
```

Test placement: pure/server tests live next to the source as `*.test.ts` (Vitest node project). Component tests are `src/lib/components/*.svelte.test.ts` (Vitest browser project, Chromium).

---

### Task 1: Scaffold, config, toolchain

**Files:**

- Create: everything `sv create` makes; `src/lib/server/config.ts`; `.env.example`; `.gitignore` additions (`.env`, `serve.json`, `test-results/`, `playwright-report/`)
- Modify: `vite.config.ts`, `package.json`

**Interfaces:**

- Produces: `pocketbaseUrl(): string` (reads `process.env.POCKETBASE_URL` at call time, default `http://127.0.0.1:8090`, trailing slash stripped). Scripts `check`, `lint`, `test:unit`, `test:e2e`, `build`, `start` (`node build`).

- [ ] **Step 1:** `npx sv@latest create . --template minimal --types ts --add vitest prettier eslint playwright sveltekit-adapter="adapter:node" --install npm`. If the flags changed, run interactively and pick the same. Pin every dependency in `package.json` to the exact installed version. Add `pocketbase@0.29.0`, `barcode-detector@3.2.4`, `undici` (latest 7.x/8.x matching Node 24), dev `@axe-core/playwright@4.14.0`, `bwip-js`.
- [ ] **Step 2:** Read https://svelte.dev/docs/kit/adapter-node. Set `paths.origin` from `process.env.ORIGIN` in `vite.config.ts`. If the docs list a runtime env override for origin, use that instead and record which in `.env.example`.
- [ ] **Step 3: Failing test** `src/lib/server/config.test.ts`:
  ```ts
  it('defaults', () => {
  	delete process.env.POCKETBASE_URL;
  	expect(pocketbaseUrl()).toBe('http://127.0.0.1:8090');
  });
  it('strips trailing slash', () => {
  	process.env.POCKETBASE_URL = 'http://x:8090/';
  	expect(pocketbaseUrl()).toBe('http://x:8090');
  });
  ```
- [ ] **Step 4:** `npm run test:unit -- --run src/lib/server/config.test.ts` → FAIL (module missing). Implement. Re-run → PASS.
- [ ] **Step 5:** `npm run check && npm run lint && npm run build` → all exit 0.
- [ ] **Step 6:** Commit `chore: Scaffold SvelteKit 3 app.`

### Task 2: Collection registry + schema fixture

**Files:**

- Create: `src/lib/collections.ts`, `src/lib/collections.test.ts`, `tests/fixtures/rivendell-schema.json`

**Interfaces:**

- Produces:

  ```ts
  export type MetaType = 'definition' | 'genre' | 'platform' | 'status' | 'tags';
  export type FieldType =
  	'text' | 'textarea' | 'number' | 'url' | 'date' | 'bool' | 'select' | 'meta' | 'tags' | 'json';
  export interface FieldDef {
  	name: string;
  	label: string;
  	type: FieldType;
  	required?: boolean;
  	metaType?: MetaType;
  	options?: readonly string[];
  	scan?: 'isbn' | 'barcode';
  }
  export interface CollectionDef {
  	name: string;
  	label: string;
  	titleField: string; // display label, mirrors recordLabel() in rivendell/enrichers.go
  	keyField: string; // field the user sends that identifies the record (lookup after generic 400)
  	image?: 'cover' | 'image';
  	imageAspect?: '2 / 3' | '1 / 1' | '63 / 88';
  	columns: readonly FieldDef[];
  	searchFields: readonly string[];
  	sortable: readonly string[];
  	defaultSort: string;
  	expand: readonly string[];
  	create: readonly FieldDef[];
  	slowCreate?: boolean;
  }
  export const COLLECTIONS: readonly CollectionDef[]; // 15 + meta, order = nav order
  export function getCollection(name: string): CollectionDef | undefined;
  ```

- [ ] **Step 1:** Generate the fixture from the live DB, read-only and immutable, field names and types only:
      `sqlite3 "file:<rivendell pb_data>/data.db?mode=ro&immutable=1" "select json_group_object(name, (select json_group_array(json_object('name',json_extract(f.value,'$.name'),'type',json_extract(f.value,'$.type'),'required',json_extract(f.value,'$.required'))) from json_each(fields) f)) from _collections where system=0 and type='base'"` → `tests/fixtures/rivendell-schema.json` (pretty-print it). Only the `_collections` table is read.
- [ ] **Step 2: Failing tests** `collections.test.ts`. Load the fixture and assert, for every `def` in `COLLECTIONS`:
  - `Object.keys(fixture)` sorted equals `COLLECTIONS.map(c=>c.name)` sorted (16 names).
  - every `columns`/`create`/`searchFields` base name (part before `.`) exists in `fixture[def.name]`.
  - every fixture field with `required: true` (except `id`, and except auto-filled `title`/`creator` on videos) appears in `def.create` with `required: true`.
  - `create` never contains `cover`, `archive`, `dead`, `shared`, `image`, `back`, `id`.
  - `defaultSort` is `-@rowid` or a `sortable` entry (with optional `-`). `sortable` never contains `created`/`updated`.
  - `meta`/`tags` create fields have `metaType`. `tags` fields have `type: 'tags'`.
  - `image` set exactly for books, cds, games, movies, shows, vinyls (`cover`) and mtg (`image`).
  - `scan`: books.isbn = `'isbn'`; barcode on cds, vinyls, games, movies, shows = `'barcode'`; nothing else.
  - `slowCreate` true exactly for articles, podcasts, videos.
- [ ] **Step 3:** Run → FAIL. Implement `COLLECTIONS` from Rivendell `docs/API.md` "Send" lists and `schema/collections.go`:
  - titleField/keyField: cds/vinyls `album`/`album`; mtg `name`/`name`; github `url`/`url`; watch_later `link`/`link`; videos `title`/`url`; records `company`/`company`; meta `name`/`name`; others `title`/`title`.
  - searchFields include relation paths (`tags.name`, `genre.name`) where the collection has them.
  - `feeds.type` and `meta.type` are `select` with their option lists.
  - `records.stack` is `json`; `start`/`end` are `date`.
  - `mtg.collector_number` is `number`.
- [ ] **Step 4:** Run → PASS. Commit `feat: Add collection registry.`

### Task 3: PocketBase client, auth guard, login/logout, mock PB, Playwright

**Files:**

- Create: `src/lib/server/pb.ts`, `src/lib/server/auth.ts`, `src/hooks.server.ts`, `src/app.d.ts`, `src/routes/login/*`, `src/routes/logout/+page.server.ts`, `src/routes/+error.svelte`, `tests/e2e/mock-pb/server.ts`, `tests/e2e/mock-pb/seed.ts`, `tests/e2e/auth.spec.ts`, `playwright.config.ts`; tests `pb.test.ts`, `auth.test.ts`

**Interfaces:**

- Consumes: `pocketbaseUrl()` (Task 1).
- Produces:
  ```ts
  // pb.ts
  export const AUTH_COOKIE = 'pb_auth';
  export const CREATE_TIMEOUT_MS = 600_000;
  export function createPb(): PocketBase; // base url + autoCancellation(false)
  export function longFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response>; // undici Agent headersTimeout/bodyTimeout = CREATE_TIMEOUT_MS + AbortSignal.timeout(CREATE_TIMEOUT_MS)
  export function toHttpError(err: unknown): { status: number; message: string };
  // auth.ts
  export function safeNext(next: string | null): string; // '/' unless starts with '/' and not '//' or '/\'
  export function cookieOptions(url: URL): {
  	httpOnly: true;
  	sameSite: 'Lax';
  	path: '/';
  	secure: boolean;
  };
  // app.d.ts: App.Locals { pb: PocketBase; user: { id: string; email: string } | null }
  ```
- Mock PB (`tests/e2e/mock-pb/server.ts`): `startMockPb(port = 8099): Promise<{ close(): Promise<void>; reset(): void; setDelay(ms: number): void }>`, plus a CLI entry so Playwright `webServer` can run it. Control endpoints: `POST /__mock/reset`, `POST /__mock/delay {ms}`, `POST /__mock/down {down:boolean}` (when down, every API route destroys the socket).

- [ ] **Step 1: Failing unit tests.**
  - `safeNext`: `null`→`/`; `'/movies?q=a'`→same; `'//evil.com'`→`/`; `'/\\evil'`→`/`; `'https://evil.com'`→`/`.
  - `cookieOptions(new URL('https://b.ts.net')).secure === true`; `http://localhost:4173` → `false`.
  - `toHttpError`: `ClientResponseError` status 0 → `{503, 'Rivendell is unreachable'}`; status 404 → `{404, 'Not found'}`; status 401/403 → `{401, 'Session expired'}`; other → `{502, 'Rivendell error'}`; non-PB `Error` → `{500, 'Unexpected error'}`.
- [ ] **Step 2:** Run → FAIL. Implement `pb.ts`, `auth.ts`. Run → PASS.
- [ ] **Step 3:** Implement `hooks.server.ts`:
  - `handle`: create a pb client and `loadFromCookie(request cookie header, AUTH_COOKIE)`. If the token is valid and `isSuperuser`, call `_superusers.authRefresh()`; on any refresh error, `clear()`. Set `locals.user`. Routes other than `/login` with no user → `redirect(303, '/login?next=' + encodeURIComponent(path+search))`. Append `pb.authStore.exportToCookie(cookieOptions(url), AUTH_COOKIE)` to the response.
  - `handleError`: return `toHttpError(error)` (status + message). Log the raw error server-side.
- [ ] **Step 4:** Login page: email + password form, `?/default` action → `_superusers.authWithPassword`. Success → `redirect(303, safeNext(url.searchParams.get('next')))`. 400 → `fail(400, { message: 'Wrong email or password', email })`. Response containing `mfaId` → `fail(401, { message: 'This account requires MFA, which Bruinen does not support yet', email })`. Logout: POST action clears the store and redirects to `/login`. `+error.svelte` shows `page.status` and `page.error.message` with a link home.
- [ ] **Step 5:** Mock PB auth: `POST /api/collections/_superusers/auth-with-password` accepts `admin@test.local`/`password123`, and `mfa@test.local` → `401 {mfaId:'x'}`. `POST .../auth-refresh` accepts only tokens the mock issued. Tokens are unsigned JWTs with `{exp: now+86400, type:'auth', collectionId:'pbc_3142635823'}`, and the record is `{id, email, collectionName:'_superusers', collectionId:'pbc_3142635823'}`.
- [ ] **Step 6:** `playwright.config.ts`: two `webServer`s: the mock PB on 8099, then `npm run build && node build` with `ORIGIN=http://localhost:4173 PORT=4173 POCKETBASE_URL=http://127.0.0.1:8099`. Projects: `chromium` (Desktop Chrome) and `mobile-webkit` (iPhone 15). `beforeEach` → `POST /__mock/reset`. Helper `login(page)` in `tests/e2e/helpers.ts`.
- [ ] **Step 7: Failing e2e** `auth.spec.ts`:
  - visiting `/movies` logged out lands on `/login?next=%2Fmovies`.
  - wrong password shows `Wrong email or password`.
  - good login returns to `/movies`.
  - `mfa@test.local` shows the MFA message.
  - setting cookie `pb_auth=garbage` then visiting `/` lands on `/login` (Review Focus 2).
  - logout returns to `/login`, and `/` redirects again.
- [ ] **Step 8:** `npm run test:e2e -- auth.spec.ts` → PASS on both projects. Commit `feat: Add superuser login and auth guard.`

### Task 4: List query builder

**Files:**

- Create: `src/lib/server/query.ts`, `src/lib/server/query.test.ts`

**Interfaces:**

- Consumes: `CollectionDef` (Task 2).
- Produces:

  ```ts
  export const PER_PAGE = 30;
  export interface ListQuery {
  	q: string;
  	sort: string;
  	page: number;
  	view: 'table' | 'cards' | null;
  }
  export function parseListQuery(url: URL, def: CollectionDef): ListQuery;
  export function buildListOptions(
  	def: CollectionDef,
  	query: ListQuery,
  	filter: (expr: string, params: Record<string, unknown>) => string
  ): { sort: string; filter?: string; expand?: string };
  ```

- [ ] **Step 1: Failing tests** (use `new PocketBase('http://x').filter` as the `filter` argument):
  - empty URL → `{ q:'', sort: def.defaultSort, page: 1, view: null }`.
  - `page=abc`, `page=-3`, `page=0` → `1`. `page=999` stays `999` (the page clamps after the response).
  - `sort=year` / `sort=-year` kept when `year` is in `sortable`. `sort=password` → `defaultSort`. `sort=--year` → `defaultSort`.
  - `view=cards` kept only when `def.image` is set. `view=x` → `null`.
  - `q='  O\'Brien  '` → trimmed. `buildListOptions(...).filter` for movies equals `pb.filter("title ~ {:q} || director ~ {:q} || genre.name ~ {:q}", {q:"O'Brien"})` (literal equality with the SDK's escaping).
  - `q='|| id != ""'` → appears only inside one quoted literal (assert the result matches `/^title ~ '.*' \|\|/` and the operator text is inside quotes).
  - `expand` = `def.expand.join(',')`, or `undefined` when empty.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS. Commit `feat: Add list query parsing and filter builder.`

### Task 5: Browse: layout, home, table, search/sort/pagination

**Files:**

- Create: `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+layout.server.ts`, `src/routes/+page.svelte`, `src/routes/+page.server.ts`, `src/routes/[collection]/+page.server.ts`, `src/routes/[collection]/+page.svelte`, `src/lib/components/{DataTable,Toolbar,Pagination}.svelte`, `DataTable.svelte.test.ts`, `tests/e2e/browse.spec.ts`
- Modify: `tests/e2e/mock-pb/server.ts`, `seed.ts`

**Interfaces:**

- Consumes: `COLLECTIONS`, `getCollection`, `parseListQuery`, `buildListOptions`, `PER_PAGE`, `locals.pb`.
- Produces: `[collection]` load returns `{ def: CollectionDef; query: ListQuery; items: RecordModel[]; page: number; totalPages: number; totalItems: number; meta: Record<MetaType, string[]> }`. `meta` holds only the types the def's create form uses, loaded with one `getFullList` of `meta` sorted by `name`.
- `DataTable` props: `{ def: CollectionDef; items: RecordModel[]; query: ListQuery }`. Each sortable header is an `<a>` to the toggled `sort`, with `aria-sort` on the `<th>`. The title cell links to `/{collection}/{id}`. Relation cells read `item.expand[field].name` (arrays joined `, `).

- [ ] **Step 1: Mock PB list.** `GET /api/collections/:c/records` supports `page`, `perPage`, `sort` (one field, `-` prefix, `@rowid`), `filter` (parse only the `field ~ 'value'` terms joined by `||`; case-insensitive contains; resolve `x.name` through the seeded meta), and `expand` (attach meta records). `GET .../records/:id`. Unknown collection → 404. Seed: meta (genres rock, jazz, drama, sci-fi; statuses not_started, in_progress, completed; definitions 1080p, 4k; platforms pc, ps5; tags go, music, tech), 35 movies (one titled `O'Brien`, one with no cover, one with a cover URL that 404s), 3 books, 2 mtg, 2 cds, 1 of each other collection.
- [ ] **Step 2: Failing component test** `DataTable.svelte.test.ts`:
  - movies with `sort='-year'` → the year `<th>` has `aria-sort="descending"` and its link href contains `sort=year`.
  - unsorted headers have `aria-sort="none"`.
  - genre cell shows the expanded name `drama`, not the ID.
  - title cell link `href="/movies/<id>"`.
- [ ] **Step 3:** Run → FAIL. Implement DataTable. Run → PASS.
- [ ] **Step 4:** Implement the rest:
  - load: unknown collection → `error(404, 'Not found')`; `page > totalPages && totalItems > 0` → render empty state with a link to page 1.
  - Toolbar: a GET `<form>` with search input (`type=search`, label "Search {label}", 300ms debounce, then `requestSubmit`), a sort `<select>` visible below 640px, and preserved hidden `view`.
  - Pagination: prev/next plus "Page n of m", links keep `q`/`sort`/`view`.
  - Layout nav: collection links (scrolling chip row below 640px, sidebar from 1024px), skip link, logout form button.
  - Home: grid of collections with counts via `getList(1, 1, { fields: 'id' })` in parallel.
  - Stacked table rows below 640px through CSS (`td::before { content: attr(data-label) }`).
- [ ] **Step 5: Failing e2e** `browse.spec.ts`:
  - home lists 16 collections with counts.
  - `/movies` shows 30 rows and "Page 1 of 2"; next → 5 rows.
  - search `o'brien` → 1 row (Review Focus 4).
  - clicking the Year header orders descending, then ascending.
  - `/movies?page=abc&sort=password&view=x` renders page 1 with default sort (Review Focus 5).
  - `/movies?page=999` shows the empty state with a page-1 link.
  - `/nope` → 404 page.
  - `POST /__mock/down {down:true}` then `/movies` → page shows `Rivendell is unreachable` with status 503 (Review Focus 3).
  - at 390px wide, the first row's cells show labels.
- [ ] **Step 6:** `npm run test:unit && npm run test:e2e -- browse.spec.ts` → PASS. Commit `feat: Add collection browsing with search, sort and pagination.`

### Task 6: Cards, view toggle, record detail

**Files:**

- Create: `src/lib/components/CardGrid.svelte`, `CardGrid.svelte.test.ts`, `src/routes/[collection]/[id]/+page.server.ts`, `+page.svelte`, `tests/e2e/cards.spec.ts`
- Modify: `Toolbar.svelte` (view toggle), `[collection]/+page.svelte`

**Interfaces:**

- Consumes: Task 5 load data. `def.image`, `def.imageAspect`, `def.titleField`.
- Produces: `CardGrid` props `{ def: CollectionDef; items: RecordModel[] }`. Detail load returns `{ def, record }` (`getOne` with `expand`).
- View resolution in the page: `query.view ?? (def.image && viewport < 640px ? 'cards' : 'table')`. The no-JS SSR default is `cards` for image collections and `table` otherwise. The toggle is a pair of links with `aria-current`.

- [ ] **Step 1: Failing component tests:**
  - card `<img>` has `alt` equal to the record's titleField, `loading="lazy"`, and the container style `aspect-ratio: 63 / 88` for mtg.
  - an item with an empty cover renders `[data-testid=cover-placeholder]` and no `<img>`.
  - firing `error` on the `<img>` swaps in the placeholder (Review Focus 1).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Detail page: a definition list of every non-empty field (relations show names, `url`/`archive`/`cover` as links opening in a new tab with `rel="noopener"`, `stack` as chips) and the cover image when present. A back link keeps the list query from the `Referer` only when it's same-origin; otherwise it goes to `/{collection}`.
- [ ] **Step 4: Failing e2e** `cards.spec.ts`:
  - `/movies?view=cards` shows cards, and the movie with a 404 cover shows the placeholder.
  - the toggle switches to the table and the URL gets `view=table`.
  - `/articles` has no cards toggle.
  - clicking a card opens the detail page with the genre name.
  - mobile-webkit `/games` with no `view` param shows cards.
- [ ] **Step 5:** PASS. Commit `feat: Add cover cards and record detail page.`

### Task 7: Create flow

**Files:**

- Create: `src/lib/server/payload.ts`, `payload.test.ts`, `src/lib/server/create.ts`, `create.test.ts`, `src/lib/components/{CreateDialog,FieldInput,Toast}.svelte`, `CreateDialog.svelte.test.ts`, `tests/e2e/create.spec.ts`
- Modify: `[collection]/+page.server.ts` (`actions.create`), `[collection]/+page.svelte`, mock PB

**Interfaces:**

- Consumes: `FieldDef`, `CollectionDef.create/keyField/slowCreate`, `longFetch`, `CREATE_TIMEOUT_MS`.
- Produces:
  ```ts
  // payload.ts
  export type FieldErrors = Record<string, string>;
  export function buildPayload(
  	def: CollectionDef,
  	form: FormData
  ): { data: Record<string, unknown>; errors: FieldErrors };
  export function mapPbError(err: unknown): {
  	message: string;
  	fields: FieldErrors;
  	generic: boolean;
  };
  // create.ts
  export type CreateResult =
  	| { kind: 'created'; id: string; label: string }
  	| { kind: 'saved-unenriched'; id: string; label: string }
  	| { kind: 'pending' }
  	| { kind: 'invalid'; message: string; fields: FieldErrors };
  export function createRecord(
  	pb: PocketBase,
  	def: CollectionDef,
  	data: Record<string, unknown>
  ): Promise<CreateResult>;
  ```
- Action responses: `invalid` → `fail(400, { message, fields, values })`; `pending` → `fail(504, { pending: true })`; otherwise `{ result }`.

- [ ] **Step 1: Failing tests** `payload.test.ts`:
  - books with title, author, empty isbn, genre `fiction` → `data` `{title, author, genre:'fiction'}` (empty optional dropped), no errors.
  - missing required `author` → `errors.author === 'Required'`.
  - `year='abc'` → `errors.year === 'Must be a number'`; `'1999'` → `1999`.
  - articles with `tags` given 6 times → `errors.tags === 'Up to 5 tags'`; 2 → `['go','tech']`.
  - records `stack='Go, Postgres, '` → `['Go','Postgres']`; `start='2022-01-01'` → `'2022-01-01 00:00:00.000Z'`.
  - text values are trimmed.
  - `mapPbError` on `{status:400, response:{message:'Failed to create record.', data:{url:{code:'validation_not_unique', message:'Value must be unique.'}}}}` → `fields.url === 'Value must be unique.'`, `generic:false`. On `{status:400, response:{message:'Something went wrong while processing your request.', data:{}}}` → `generic:true`.
- [ ] **Step 2: Failing tests** `create.test.ts` (fake `pb` object):
  - success → `created` with the label from `titleField`.
  - create throws a generic 400, then `getFirstListItem(keyField = value, {sort:'-@rowid'})` finds it → `saved-unenriched`; not found → `invalid` with message `Rivendell rejected this record. Check the values and try again.`
  - abort/timeout error → `pending`.
  - the create call passes `{ fetch: longFetch }` when `def.slowCreate` is true.
- [ ] **Step 3:** Run → FAIL. Implement `payload.ts`, `create.ts`. Run → PASS.
- [ ] **Step 4: Failing component test** `CreateDialog.svelte.test.ts`:
  - renders one labelled control per `def.create` field; meta fields are `<select>` with the given names; tags is a multi-select (`<select multiple>`) capped by validation.
  - `form.fields.title` shows `aria-invalid="true"` with `aria-describedby` pointing at the message.
  - while submitting on a `slowCreate` def, the submit button is disabled and reads `Archiving… this can take a few minutes`.
- [ ] **Step 5:** Run → FAIL. Implement:
  - `FieldInput` covers each `FieldType`, with `textarea` for comments and a date input.
  - `CreateDialog` is a native `<dialog>` opened with `showModal()` from a "New {label}" button (fixed bottom-right FAB below 640px). `use:enhance` posts to `?/create`; on `created`/`saved-unenriched` it closes, calls `refreshAll()` and shows a Toast linking the record (saved-unenriched copy: `Saved, but Rivendell couldn't fetch its metadata`). On `pending` it shows the timeout copy and closes. On close it returns focus to the opener. Without JS, the form posts and the page renders `form` errors in the dialog, which is open when `form` is present.
  - Toast: `role="status"` `aria-live="polite"`, auto-hide 6s, paused under `prefers-reduced-motion` (stays until dismissed).
  - Run → PASS.
- [ ] **Step 6: Mock PB create:** `POST /api/collections/:c/records` validates required fields from `tests/fixtures/rivendell-schema.json` (→ PB-style `data` errors) and resolves meta names. An unknown meta name → generic 400 without saving. A title containing `ENRICHFAIL` → saved, then generic 400. It honors `/__mock/delay`. github duplicate url → `validation_not_unique`.
- [ ] **Step 7: Failing e2e** `create.spec.ts`:
  - create a book (title, author, genre select `rock`, status `in_progress`) → toast link opens the detail page showing `rock`.
  - submit with empty author → error on the author field, dialog stays open.
  - movie titled `ENRICHFAIL test` → toast `Saved, but Rivendell couldn't fetch its metadata`.
  - duplicate github url → url field error `Value must be unique.`
  - articles with delay 1500 ms → button shows the archiving copy and is disabled, then the toast appears.
  - Esc closes the dialog and focus returns to "New Movies".
- [ ] **Step 8:** PASS. Commit `feat: Add record creation dialog.`

### Task 8: Barcode scanning

**Files:**

- Create: `src/lib/barcode.ts`, `barcode.test.ts`, `src/lib/components/BarcodeScanner.svelte`, `BarcodeScanner.svelte.test.ts`, `tests/e2e/fixtures/make-barcode-video.ts`, `tests/e2e/fixtures/ean13.y4m`, `tests/e2e/scan.spec.ts`
- Modify: `FieldInput.svelte` (scan button when `field.scan`), `playwright.config.ts` (chromium launch args)

**Interfaces:**

- Produces:
  ```ts
  // barcode.ts
  export function isValidEan13(code: string): boolean;
  export function isValidUpcA(code: string): boolean;
  export function isbn10To13(isbn10: string): string | null;    // null when the ISBN-10 check digit fails
  export function normalizeScan(raw: string, target: 'isbn' | 'barcode'): string | null;
  // BarcodeScanner props
  { target: 'isbn' | 'barcode'; ondetect: (code: string) => void; onclose: () => void;
    createDetector?: () => Promise<{ detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> }>;
    getStream?: () => Promise<MediaStream>; }
  ```
- Default `createDetector`: native `BarcodeDetector` when `getSupportedFormats()` includes `ean_13`; otherwise `(await import('barcode-detector/ponyfill')).BarcodeDetector`. Formats `['ean_13','ean_8','upc_a','upc_e']`. Default `getStream`: `getUserMedia({ video: { facingMode: 'environment' } })`.

- [ ] **Step 1: Failing tests** `barcode.test.ts`:
  - `isValidEan13('9780451524935')` true; `'9780451524936'` false.
  - `isValidUpcA('036000291452')` true.
  - `isbn10To13('0451524934')` → `'9780451524935'`; `'0451524935'` → `null`; `'080442957X'` → `'9780804429573'`.
  - `normalizeScan('9780451524935','isbn')` → same; `'0451524934','isbn'` → `'9780451524935'`; `'0828768199121','isbn'` → `null` (not 978/979).
  - `normalizeScan('036000291452','barcode')` → `'036000291452'`; `'123','barcode'` → `null`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Failing component test** `BarcodeScanner.svelte.test.ts` with injected fakes:
  - `getStream` rejects `NotAllowedError` → text `Camera access was denied. Type the code instead.` and a close button.
  - a fake detector returning `[]`, then `[{rawValue:'9780451524935'}]` → `ondetect('9780451524935')` called once, and the stream tracks are stopped.
  - an invalid code is ignored and scanning continues.
- [ ] **Step 4:** Run → FAIL. Implement:
  - a `requestAnimationFrame` loop on a `<video playsinline muted>`.
  - torch toggle shown when `track.getCapabilities().torch`.
  - `navigator.vibrate?.(50)` on detect.
  - Esc and the close button stop the tracks.
  - Wire into `FieldInput`: the "Scan" button (`aria-label="Scan {field.label}"`) opens the scanner in a nested `<dialog>`, and detect fills the input.
  - Run → PASS.
- [ ] **Step 5:** `make-barcode-video.ts`: `bwip-js` renders EAN-13 `9780451524935` as PNG, then `ffmpeg -loop 1 -i code.png -vf "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:white" -frames:v 1 -pix_fmt yuv420p ean13.y4m`. Run it once, commit the `.y4m` (about 460 KB) and the script.
- [ ] **Step 6: Failing e2e** `scan.spec.ts` (chromium project only; launch args `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-video-capture=tests/e2e/fixtures/ean13.y4m`): open New Books, click "Scan ISBN", and expect the isbn input to have value `9780451524935` within 10 s.
- [ ] **Step 7:** PASS. Commit `feat: Add camera barcode scanning.`

### Task 9: Accessibility sweep + real-Rivendell smoke

**Files:**

- Create: `tests/e2e/a11y.spec.ts`, `tests/e2e/smoke-real.spec.ts`

- [ ] **Step 1: Failing e2e** `a11y.spec.ts`: axe (`withTags(['wcag2a','wcag2aa','wcag21aa'])`) on `/login`, `/`, `/movies`, `/movies?view=cards`, a detail page, the open create dialog, the empty state and the 404 page, in both projects and both color schemes (`page.emulateMedia({ colorScheme })`). Each must have zero violations. Also: Tab from page load reaches the skip link first, and every interactive element's bounding box is ≥ 44×44 at 390px.
- [ ] **Step 2:** Fix violations until PASS.
- [ ] **Step 3:** `smoke-real.spec.ts`: skipped unless `E2E_REAL_PB=1`. It uses `REAL_PB_EMAIL`/`REAL_PB_PASSWORD` against the running app (`BASE_URL`), logs in, opens every collection, and asserts no error page. Read-only: it never opens the create dialog.
- [ ] **Step 4:** Commit `test: Add accessibility and real-Rivendell smoke specs.`

### Task 10: Container and tailnet deployment

**Files:**

- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `serve.json.example`, `README.md`
- Modify: `.env.example`

- [ ] **Step 1:** Invoke `anthropic-skills:homelab-compose` and follow its sidecar conventions where they don't conflict with this plan.
- [ ] **Step 2:** `Dockerfile`: `node:24-alpine` builder (`ARG ORIGIN`, `npm ci`, `npm run build`, `npm prune --omit=dev`) → runtime (`USER node`, copy `build/`, `node_modules`, `package.json`; `ENV PORT=3000`; `HEALTHCHECK` wget `/login`; `CMD ["node","build"]`).
- [ ] **Step 3:** `docker-compose.yml`:
  - `tailscale` service: hostname `bruinen`, `TS_AUTHKEY=${TS_AUTHKEY}`, `TS_SERVE_CONFIG=/config/serve.json`, state volume bound to `<PATH>/bruinen/tailscale` (same `driver_opts` pattern as Rivendell), healthcheck on `127.0.0.1:41236/healthz`.
  - `app` service: build arg `ORIGIN=${ORIGIN}`, env `POCKETBASE_URL=http://rivendell-app:8090`, networks `internal` (alias `bruinen-app`) and external `rivendell_internal`; `depends_on` tailscale healthy.
  - `serve.json.example` proxies `/` → `http://bruinen-app:3000`.
- [ ] **Step 4:** README: setup (`.env` from example, `serve.json` from example), `mkdir -p <PATH>/bruinen/tailscale`, the **SuperuserIPs note** (add the `rivendell_internal` subnet, found with `docker network inspect rivendell_internal`, if that setting is used), scripts, the test matrix, and the scan e2e's ffmpeg requirement only for regenerating the fixture.
- [ ] **Step 5:** Verify: `docker compose config` exits 0 and `docker build --build-arg ORIGIN=https://bruinen.example.ts.net .` succeeds. Commit `feat: Add container and tailnet deployment.`

---

## Final verification

- `npm run check && npm run lint && npm run test:unit -- --run && npm run test:e2e` all exit 0.
- With Rivendell running: `POCKETBASE_URL=https://rivendell.<tailnet>.ts.net ORIGIN=http://localhost:4173 npm run build && PORT=4173 node build`, then `E2E_REAL_PB=1 BASE_URL=http://localhost:4173 npx playwright test smoke-real` → PASS. Open one movie in cards view and confirm B2 covers render; if they don't, the bucket is private and a `/img` proxy route is needed (new task).
- Manual, on a phone over the tailnet after `docker compose up -d --build`: log in, scan a real book ISBN in New Books, and confirm the field fills. Creating a record writes to the live Rivendell; only do it if you want to keep that record.
