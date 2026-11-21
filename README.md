# Bruinen

A mobile-first web app for browsing, searching and adding records to [Rivendell](../rivendell), the PocketBase-backed media catalog. It runs on the tailnet only, at `https://bruinen.<your-tailnet>.ts.net`, next to Rivendell.

- Browse every Rivendell collection as a table, or as cover cards for movies, shows, games, books, CDs, vinyls and MTG.
- Search and sort, with all list state in the URL.
- Add records through Rivendell's create API, including barcode/ISBN scanning with the phone camera.
- Edit a record from its page, with the same form plus its favorite/dead/shared flags.
- Sign in with a Rivendell **superuser** account. The session lives in an httpOnly cookie, and the browser never talks to PocketBase directly.

Bruinen reads, creates and edits records. It never deletes them.

Edits are plain PocketBase updates: Rivendell has no update hook, so saving never re-fetches covers, archives or other enriched data. Bruinen sends only the fields you changed, and turns meta names into meta IDs itself.

## Stack

SvelteKit 3 (Svelte 5, `adapter-node`) on Node 24, the `pocketbase` JS SDK on the server, plain CSS, and `barcode-detector` (native `BarcodeDetector` where available, otherwise a self-hosted zxing WASM build for iOS Safari).

## Develop

```sh
pnpm install   # Node and pnpm versions come from .nvmrc and package.json "packageManager"
cp .env.example .env   # point POCKETBASE_URL at Rivendell, e.g. https://rivendell.<tailnet>.ts.net
pnpm dev
```

| Script               | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `pnpm dev`           | Vite dev server                                                 |
| `pnpm check`         | svelte-check (types)                                            |
| `pnpm lint`          | Prettier + ESLint                                               |
| `pnpm test:unit`     | Vitest: `server` project (node) and `client` project (browser)  |
| `pnpm test:e2e`      | Playwright against a mock PocketBase (Chromium + mobile WebKit) |
| `pnpm build`         | Production build into `build/`                                  |
| `pnpm start`         | Run the production build (`node build`)                         |
| `pnpm docker:deploy` | Build and start the Docker stack (see Deploy on the tailnet)    |

The collection registry in `src/lib/collections.ts` drives every table, card, search, sort and create form. It's checked against `tests/fixtures/rivendell-schema.json`, a snapshot of Rivendell's live schema. Regenerate the snapshot if Rivendell's schema changes.

### Tests

- **Unit/component** (`pnpm test:unit --run`): pure logic next to the source as `*.test.ts`, and components as `*.svelte.test.ts` in a real Chromium.
- **E2E** (`pnpm test:e2e`): builds the app and runs it against `tests/e2e/mock-pb`, an in-memory PocketBase stand-in with seeded data. No real APIs are called. Install browsers once with `pnpm exec playwright install chromium webkit`.
- **Barcode scanning** e2e uses Chromium's fake camera playing `tests/e2e/fixtures/ean13.y4m`. To regenerate it you need ffmpeg: `node tests/e2e/fixtures/make-barcode-video.ts`.
- **Real Rivendell smoke test** (read-only: signs in and opens every collection):

  ```sh
  E2E_REAL_PB=1 BASE_URL=http://localhost:4173 REAL_PB_EMAIL=… REAL_PB_PASSWORD=… \
    pnpm exec playwright test smoke-real --project chromium
  ```

## Deploy on the tailnet

Bruinen runs as two containers: the app plus its own Tailscale sidecar (hostname `bruinen`). The app joins Rivendell's Docker network (`rivendell_internal`) and reaches PocketBase at `http://rivendell-app:8090`. No host ports are published.

1. Create `.env` from `.env.example`. Set `ORIGIN` to `https://bruinen.<your-tailnet>.ts.net` and `TS_AUTHKEY` to a fresh auth key from the Tailscale admin console.
2. Create `serve.json` from `serve.json.example`, with your tailnet name filled in. It's gitignored.
3. Set `TAILSCALE_STATE_DIR` in `.env` to a host folder for the Tailscale node's state, and create it with `mkdir -p`.
4. Make sure Rivendell is up (its network must exist), then build and start the stack:

   ```sh
   pnpm docker:deploy
   ```

   It runs `docker compose up -d --build` with `POCKETBASE_URL=http://rivendell-app:8090`, overriding whatever `.env` sets for `pnpm dev`. The container isn't on the tailnet, so a `https://rivendell.<tailnet>.ts.net` URL would not resolve from inside it.

5. Wait for both services to report `healthy` (about a minute), then open `https://bruinen.<your-tailnet>.ts.net`. The first load can take a few seconds while Tailscale issues the certificate.

   ```sh
   docker compose ps
   docker compose logs -f app
   ```

To update after pulling new code, run `pnpm docker:deploy` again.

If a `bruinen` node existed on the tailnet before, delete it first. Otherwise Tailscale names the new node `bruinen-1` and `serve.json` no longer matches.

**PocketBase superuser IP allowlist.** If Rivendell has _Settings → Superuser IPs_ set, superuser requests from any other address are rejected, and Bruinen's logins will fail. Add the `rivendell_internal` subnet, which you can look up with:

```sh
docker network inspect rivendell_internal --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
```

**Covers.** Card images load straight from the Backblaze B2 URLs Rivendell stores, so the bucket must allow public reads. If covers show placeholders everywhere, check that first.

**Replacing covers.** A record page can replace a wrong or missing cover with a JPEG (up to 10 MB). Bruinen strips the photo's metadata (EXIF, including GPS), uploads it to B2 and saves the link on the record. To turn it on, create a separate application key for Bruinen in the Backblaze console (Application Keys → Add a New Application Key): allow access to the covers bucket only, with only the `writeFiles` capability. Put its key ID and key, plus the bucket's ID and name, in `.env` as `B2_APP_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_ID` and `B2_BUCKET_NAME`. Without all four, the control is hidden.

- A cover already in the bucket is replaced in place: same file name, same link. A record with no cover gets a name built the way Rivendell builds it. If another record uses the same file, the record gets its own file instead, so the other cover doesn't change.
- Bruinen never deletes anything in B2. B2 keeps the replaced file as an older version; the bucket's lifecycle settings decide whether it is ever removed.
- The device you upload from shows the new cover right away. Other devices may keep showing the old one until their cover cache drops it.
