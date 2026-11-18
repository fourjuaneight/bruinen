# Bruinen

A mobile-first web app for browsing, searching and adding records to
[Rivendell](../rivendell), the PocketBase-backed media catalog. It runs on the tailnet only, at
`https://bruinen.<your-tailnet>.ts.net`, next to Rivendell.

- Browse every Rivendell collection as a table, or as cover cards for movies, shows, games,
  books, CDs, vinyls and MTG.
- Search and sort, with all list state in the URL.
- Add records through Rivendell's create API, including barcode/ISBN scanning with the phone camera.
- Sign in with a Rivendell **superuser** account. The session lives in an httpOnly cookie, and
  the browser never talks to PocketBase directly.

Bruinen only reads and creates. It never edits or deletes records.

## Stack

SvelteKit 3 (Svelte 5, `adapter-node`) on Node 24, the `pocketbase` JS SDK on the server,
plain CSS, and `barcode-detector` (native `BarcodeDetector` where available, otherwise a
self-hosted zxing WASM build for iOS Safari).

## Develop

```sh
pnpm install   # Node and pnpm versions come from .nvmrc and package.json "packageManager"
cp .env.example .env   # point POCKETBASE_URL at Rivendell, e.g. https://rivendell.<tailnet>.ts.net
pnpm dev
```

| Script           | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Vite dev server                                                 |
| `pnpm check`     | svelte-check (types)                                            |
| `pnpm lint`      | Prettier + ESLint                                               |
| `pnpm test:unit` | Vitest: `server` project (node) and `client` project (browser)  |
| `pnpm test:e2e`  | Playwright against a mock PocketBase (Chromium + mobile WebKit) |
| `pnpm build`     | Production build into `build/`                                  |
| `pnpm start`     | Run the production build (`node build`)                         |

The collection registry in `src/lib/collections.ts` drives every table, card, search, sort
and create form. It's checked against `tests/fixtures/rivendell-schema.json`, a snapshot of
Rivendell's live schema. Regenerate the snapshot if Rivendell's schema changes.

### Tests

- **Unit/component** (`pnpm test:unit --run`): pure logic next to the source as
  `*.test.ts`, and components as `*.svelte.test.ts` in a real Chromium.
- **E2E** (`pnpm test:e2e`): builds the app and runs it against `tests/e2e/mock-pb`, an
  in-memory PocketBase stand-in with seeded data. No real APIs are called. Install browsers
  once with `pnpm exec playwright install chromium webkit`.
- **Barcode scanning** e2e uses Chromium's fake camera playing
  `tests/e2e/fixtures/ean13.y4m`. To regenerate it you need ffmpeg:
  `node tests/e2e/fixtures/make-barcode-video.ts`.
- **Real Rivendell smoke test** (read-only: signs in and opens every collection):

  ```sh
  E2E_REAL_PB=1 BASE_URL=http://localhost:4173 REAL_PB_EMAIL=… REAL_PB_PASSWORD=… \
    pnpm exec playwright test smoke-real --project chromium
  ```

## Deploy on the tailnet

Bruinen runs as two containers: the app plus its own Tailscale sidecar (hostname `bruinen`).
The app joins Rivendell's Docker network (`rivendell_internal`) and reaches PocketBase at
`http://rivendell-app:8090`. No host ports are published.

1. Create `.env` from `.env.example`. Set `ORIGIN` to `https://bruinen.<your-tailnet>.ts.net`
   and `TS_AUTHKEY` to a fresh auth key from the Tailscale admin console.
2. Create `serve.json` from `serve.json.example`, with your tailnet name filled in. It's
   gitignored.
3. Create the Tailscale state folder: `mkdir -p <PATH>/Docker/bruinen/tailscale`.
4. Make sure Rivendell is up (its network must exist), then run `docker compose up -d --build`.

If a `bruinen` node existed on the tailnet before, delete it first. Otherwise Tailscale names
the new node `bruinen-1` and `serve.json` no longer matches.

**PocketBase superuser IP allowlist.** If Rivendell has _Settings → Superuser IPs_ set,
superuser requests from any other address are rejected, and Bruinen's logins will fail. Add
the `rivendell_internal` subnet, which you can look up with:

```sh
docker network inspect rivendell_internal --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

**Covers.** Card images load straight from the Backblaze B2 URLs Rivendell stores, so the
bucket must allow public reads. If covers show placeholders everywhere, check that first.
