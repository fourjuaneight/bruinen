# Cover Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a record's cover from its Bruinen page: pick a JPEG, Bruinen strips its metadata, uploads it to B2 under the cover's existing file name, and saves the link on the record.

**Architecture:** Four server-only modules (file naming, JPEG metadata stripping, a B2 client, and a `replaceCover` orchestrator) behind a new `?/cover` form action on the record route. A `CoverUpload` component under the cover posts the file and, on success, clears the uploading device's cached copy of the cover. E2E runs against B2 routes added to the existing mock PocketBase server.

**Tech Stack:** SvelteKit 3 (Svelte 5 runes, adapter-node), TypeScript, `fetch` + `node:crypto` (no new dependency), Vitest (server + client projects), Playwright, a mock PocketBase in `tests/e2e/mock-pb`.

**Spec:** `docs/superpowers/specs/2026-11-21-cover-upload-design.md`

## Global Constraints

- Collections: only those with `def.image === 'cover'` (books, cds, games, movies, shows, vinyls). MTG is out.
- JPEG only: the server checks the first three bytes are `FF D8 FF`. The browser's type label is never trusted on the server.
- Size cap: `10 * 1024 * 1024` bytes. `BODY_SIZE_LIMIT=12M` in the Dockerfile.
- Copy, exactly:
  - "Choose a JPEG image."
  - "The image must be 10 MB or smaller."
  - "Couldn't upload the cover. Try again."
  - toast "Cover updated"
  - buttons "Replace cover" / "Add cover" / "Uploading…"
- Bruinen never deletes anything in B2. Replacing a cover changes no other record's cover.
- The B2 key never reaches the browser. Every B2 call is server-side.
- Env vars: `B2_APP_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_ID`, `B2_BUCKET_NAME`. B2 counts as configured only when all four are set. Otherwise the cover control is hidden.
- `X-Bz-Info-Author: bruinen`. `Content-Type: image/jpeg`.
- B2 call versions: `b2api/v2/b2_authorize_account`, then `b2api/v1/b2_get_upload_url` (the same as Rivendell).
- No new npm dependencies.
- Commits: Conventional Commits, capitalized imperative subject ending in a period, no attribution lines.

## Review Focus

1. **The old image still shows after upload because the same URL is served from a cache.** The `<img>` with an unchanged `src` must show the new picture without a reload, and again after a reload. Pinned by the Task 5 e2e "replaces a cover in place", which compares `naturalWidth`.
2. **A reused cover URL with percent-encoded characters.** A record whose cover is `…/file/bucket/Books/My%20Book.jpeg` must replace that exact file and keep the same URL. Pinned by the Task 1 test "reuses an encoded bucket path and rebuilds the same URL".
3. **A B2 auth token expires mid-session (12h cache, or B2 revoking early).** One re-authorize and retry, not a failed upload. Pinned by the Task 3 test "re-authorizes once when B2 answers 401".
4. **Real-world JPEG segment layouts:**
   - little-endian (`II`) EXIF
   - XMP in a second APP1
   - `0xFF` fill bytes before a marker

   These must strip correctly, not throw. Pinned by the Task 2 tests "reads little-endian Orientation", "drops every APP1" and "skips fill bytes".

5. **A cover failure must not be read as an Edit failure.** The record page currently treats any non-`updated` form result as an edit error, which would open the Edit dialog. Pinned by the Task 5 e2e "refuses a PNG labelled as JPEG", which asserts the Edit dialog stays closed.

---

### Task 1: Cover file names

**Files:**

- Create: `src/lib/server/cover-path.ts`
- Test: `src/lib/server/cover-path.test.ts`

**Interfaces:**

- Consumes: `CollectionDef` (`src/lib/collections.ts`), which has `name` and `titleField` (`album` for cds and vinyls, `title` for the others).
- Produces:
  - `fileNameFmt(name: string): string`
  - `COVER_FOLDERS: Readonly<Record<string, string>>`
  - `coverName(def: CollectionDef, record: Record<string, unknown>): string`. The name without extension; falls back to `String(record.id)` when empty.
  - `coverPath(def, record, publicPrefix: string): string`. The B2 file name (decoded), e.g. `Books/Dune.jpeg`.
  - `ownCoverPath(def, record): string`, i.e. `{Folder}/{coverName}-{record.id}.jpeg`.
  - `publicUrl(publicPrefix: string, path: string): string`. Each `/` segment is `encodeURIComponent`-encoded and the result is appended to the prefix.

- [ ] **Step 1: Write the failing tests**

`describe('fileNameFmt')`: one `it.each` over every row of Rivendell's `TestFileNameFmt` table (`~/Repos/rivendell/utils/utils_test.go:13-33`), all 21 rows, copied verbatim as `[input, want]`. Plus:

- `fileNameFmt('日本語') === ''`

`describe('coverPath')`, with `PREFIX = 'https://f005.backblazeb2.com/file/covers/'`:

- `'builds Books/{title}.jpeg when the record has no cover'`: books `{ id: 'b1', title: 'Dune', cover: '' }` gives `'Books/Dune.jpeg'`.
- `'uses album for cds and vinyls'`: cds `{ album: 'Kind of Blue' }` gives `'CDs/Kind_of_Blue.jpeg'`; vinyls gives `'Vinyls/…'`.
- `'adds -sNN to a show with a season'`: `{ title: 'Severance', season: 1 }` gives `'Shows/Severance-s01.jpeg'`. With `season: 0` it gives `'Shows/Severance.jpeg'`.
- `'adds -{year} to a movie with a year'`: `{ title: 'Alien', year: 1979 }` gives `'Movies/Alien-1979.jpeg'`. With `year: 0`, or no year, it gives `'Movies/Alien.jpeg'`.
- `'falls back to the record id for an empty name'`: books `{ id: 'b9', title: '日本語' }` gives `'Books/b9.jpeg'`.
- `'reuses the path of a cover already in the bucket'`: `cover: PREFIX + 'Movies/Alien-.jpeg'` gives `'Movies/Alien-.jpeg'`, even though the built name differs.
- `'builds a name when the cover is hosted elsewhere'`: `cover: 'https://img.example/x.jpg'` gives the built name.
- `'reuses an encoded bucket path and rebuilds the same URL'`: `cover: PREFIX + 'Books/My%20Book.jpeg'` gives `'Books/My Book.jpeg'`, and `publicUrl(PREFIX, thatPath) === record.cover`.
- `ownCoverPath(books, { id: 'b1', title: 'Dune' }) === 'Books/Dune-b1.jpeg'`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:unit --run src/lib/server/cover-path.test.ts`
Expected: FAIL, because `cover-path.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/server/cover-path.ts`**

- Port `FileNameFmt` statement by statement from `~/Repos/rivendell/utils/fileNameFmt.go:17-58`, keeping the order.
  - The `emojiRange` class comes from `~/Repos/rivendell/utils/emojiUnicode.go:8`; use a `u`-flag regex.
  - Go's `[^a-zA-Z0-9_\- ]+` is ASCII-only, so accented letters are removed, not folded.
- `COVER_FOLDERS = { books: 'Books', cds: 'CDs', games: 'Games', movies: 'Movies', shows: 'Shows', vinyls: 'Vinyls' }`.
- `coverPath` reuses the path when `record.cover` starts with `publicPrefix`: it takes the rest of the URL and applies `decodeURIComponent` to each segment.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm test:unit --run src/lib/server/cover-path.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/cover-path.ts src/lib/server/cover-path.test.ts
git commit -m "feat: Name cover files the way Rivendell does."
```

### Task 2: JPEG check and metadata stripping

**Files:**

- Create: `src/lib/server/jpeg.ts`
- Create: `tests/fixtures/jpeg.ts` (byte builders for tests only)
- Test: `src/lib/server/jpeg.test.ts`

**Interfaces:**

- Produces:
  - `isJpeg(bytes: Uint8Array): boolean`
  - `class InvalidJpegError extends Error`
  - `stripMetadata(bytes: Uint8Array): Uint8Array`, which throws `InvalidJpegError`
- Test helpers in `tests/fixtures/jpeg.ts`:
  - `seg(marker: number, payload: Uint8Array | string): Uint8Array`, i.e. `FF marker`, a big-endian length (payload + 2), then the payload
  - `exif(opts: { orientation?: number; gps?: boolean; littleEndian?: boolean }): Uint8Array`. This is an APP1 payload `Exif\0\0` followed by a TIFF header and IFD0. IFD0 holds an Orientation (0x0112, SHORT) entry when one is given. With `gps`, it also holds a GPS IFD pointer (0x8825) to a GPS IFD with GPSLatitudeRef `'N'`.
  - `jpeg(segments: Uint8Array[], scan = Uint8Array.of(1, 2, 3, 0xff, 0x00, 4)): Uint8Array`, i.e. `FFD8`, the segments, a minimal SOS segment (`FFDA`, length 8, fixed payload), the scan bytes, then `FFD9`

- [ ] **Step 1: Write the failing tests**

- `'isJpeg checks the first three bytes'`: `isJpeg(jpeg([]))` is true. A PNG signature is false, and so are `Uint8Array.of(0xff, 0xd8)` and an empty array.
- `'drops EXIF with GPS, XMP, IPTC and comments'`. Input:
  - `jpeg([seg(0xe0, 'JFIF\0…'), seg(0xe1, exif({ gps: true })), seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x/>'), seg(0xed, 'Photoshop 3.0\0…'), seg(0xfe, 'hello'), seg(0xdb, dqt)])`

  The output equals `jpeg([seg(0xe0, …), seg(0xdb, dqt)])`, byte for byte.

- `'keeps JFIF, ICC_PROFILE and Adobe segments in order'`: APP0 `JFIF\0`, APP2 `ICC_PROFILE\0…` and APP14 `Adobe…` are all kept. An APP2 that isn't ICC (e.g. `MPF\0`) is dropped.
- `'copies the scan data and everything after SOS unchanged'`: the output's tail from the `FFDA` marker on equals the input's.
- `'keeps Orientation 6 as a minimal EXIF'`: input `jpeg([seg(0xe0, jfif), seg(0xe1, exif({ orientation: 6, gps: true }))])`. The output is `jpeg([seg(0xe0, jfif), seg(0xe1, MINIMAL(6))])`. `MINIMAL(n)` is these exact bytes:
  `45 78 69 66 00 00 4D 4D 00 2A 00 00 00 08 00 01 01 12 00 03 00 00 00 01 00 0n 00 00 00 00 00 00`
- `'reads little-endian Orientation'`: `exif({ orientation: 8, littleEndian: true })` gives `MINIMAL(8)` (always written big-endian).
- `'writes no APP1 for Orientation 1 or none'`: `exif({ orientation: 1, gps: true })` or `exif({ gps: true })` leaves no `FFE1` in the output.
- `'drops every APP1, keeping the Orientation from the Exif one'`: put XMP first and EXIF with orientation 3 second. The output has exactly one APP1, which is `MINIMAL(3)`.
- `'skips fill bytes before a marker'`: insert `0xff 0xff` before a `FFFE` marker. The comment is still dropped, nothing throws, and the output carries no fill bytes.
- `'refuses truncated or SOS-less files'`:
  - a segment length past the end throws `InvalidJpegError`
  - SOI followed only by APP0 and EOF throws
  - a non-`FF` byte where a marker should be throws

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:unit --run src/lib/server/jpeg.test.ts`
Expected: FAIL, because `jpeg.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/server/jpeg.ts`**

Walk the segments starting after SOI:

```
i = 2
loop:
  require bytes[i] === 0xFF (else throw); skip further 0xFF fill bytes; m = marker
  if m === 0xDA (SOS): append bytes[markerStart..end] verbatim; done
  if m is 0x01 or 0xD0–0xD7: append the 2 marker bytes; continue
  len = big-endian u16 after marker; require 2 <= len and segment end <= bytes.length (else throw)
  keep if: m not in 0xE0–0xEF and m !== 0xFE
        or m === 0xE0 and payload starts "JFIF\0" or "JFXX\0"
        or m === 0xE2 and payload starts "ICC_PROFILE\0"
        or m === 0xEE and payload starts "Adobe"
  if m === 0xE1 and payload starts "Exif\0\0": remember Orientation from IFD0 tag 0x0112 (II or MM)
EOF without SOS: throw
```

Output order:

1. SOI
2. the kept segments up to and including the last leading APP0 (if any)
3. `seg(0xE1, MINIMAL(orientation))`, only when the orientation is not 1 and not missing
4. everything else that was kept, in its original order

Write the output as segment bytes without the fill bytes. A malformed TIFF inside EXIF means "no orientation", not a throw.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm test:unit --run src/lib/server/jpeg.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/jpeg.ts src/lib/server/jpeg.test.ts tests/fixtures/jpeg.ts
git commit -m "feat: Strip JPEG metadata without re-encoding the image."
```

### Task 3: B2 client, config and deploy settings

**Files:**

- Create: `src/lib/server/b2.ts`
- Test: `src/lib/server/b2.test.ts`
- Modify: `src/env.ts`, `src/env.test.ts`
- Modify: `src/lib/server/config.ts`, `src/lib/server/config.test.ts`
- Modify: `Dockerfile` (`ENV` line 12), `docker-compose.yml` (`app.environment`), `.env.example`, `README.md` (the "Covers" paragraph), `src/deploy.test.ts`

**Interfaces:**

- Produces:
  - `interface B2Config { keyId: string; key: string; bucketId: string; bucketName: string; apiUrl: string }`
  - `class B2Error extends Error`
  - `interface B2Client { publicPrefix(): Promise<string>; upload(path: string, bytes: Uint8Array): Promise<string> }`
  - `createB2(config: B2Config, fetchFn: typeof fetch = fetch, now: () => number = Date.now): B2Client`
  - `b2Config(): B2Config | null`, in `config.ts`, from env; `null` unless all four `B2_*` credentials are non-empty
  - `b2(): B2Client | null`, in `b2.ts`; a memoized `createB2(b2Config())`, or `null`
- `upload` returns the public URL: `publicUrl(prefix, path)` from Task 1. `publicPrefix()` is `` `${downloadUrl}/file/${bucketName}/` ``.

- [ ] **Step 1: Write the failing tests**

`b2.test.ts`, with a recording fake `fetch` that answers the three calls:

- `'authorizes with Basic keyId:key'`: the first call is `GET {apiUrl}/b2api/v2/b2_authorize_account` with `Authorization: Basic ` + base64(`id:secret`).
- `'gets an upload URL for the bucket'`: `POST {apiUrl from auth}/b2api/v1/b2_get_upload_url`, with the account token and body `{"bucketId":"bkt"}`.
- `'uploads with the B2 headers'`: `POST {uploadUrl}` with:
  - `Authorization` set to the upload token
  - `X-Bz-File-Name: Books/My%20Book.jpeg`
  - `Content-Type: image/jpeg`
  - `X-Bz-Content-Sha1` set to the hex SHA-1 of the bytes
  - `X-Bz-Info-Author: bruinen`

  The body is the bytes. It returns `https://dl.example/file/covers/Books/My%20Book.jpeg`.

- `'caches authorization for 12 hours'`: two uploads make one authorize call. Advancing `now` by `12 * 3600 * 1000 + 1` makes the next upload authorize again.
- `'re-authorizes once when B2 answers 401'`: the first `get_upload_url` returns 401 `{"code":"expired_auth_token"}`. Then there are two authorize calls and the upload succeeds. A second 401 in a row rejects with `B2Error`.
- `'rejects with B2Error on a network error or non-2xx'`.

`env.test.ts`:

- `B2_*` default to `''`.
- `B2_API_URL` defaults to `https://api.backblazeb2.com` and strips a trailing slash.

`config.test.ts`:

- `b2Config()` returns `null` when any of the four is empty. (Test the pure helper `toB2Config(env)` that `b2Config` wraps.)

`deploy.test.ts`:

- The Dockerfile sets `BODY_SIZE_LIMIT=12M`.
- `docker compose --env-file .env.example config --format json` gives `services.app.environment` containing the keys `B2_APP_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_ID` and `B2_BUCKET_NAME`. This one runs inside the existing `describe.skipIf(!hasDocker)`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:unit --run src/lib/server/b2.test.ts src/env.test.ts src/lib/server/config.test.ts src/deploy.test.ts`
Expected: FAIL. The module is missing, the env vars are undeclared, and the Dockerfile has no `BODY_SIZE_LIMIT`.

- [ ] **Step 3: Implement**

- `src/env.ts`: add `B2_APP_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET_ID`, `B2_BUCKET_NAME` (schema `(v) => v ?? ''`) and `B2_API_URL` (schema like `POCKETBASE_URL`, default `https://api.backblazeb2.com`). Each gets a one-line description. `B2_API_URL`'s says it exists for tests.
- `b2.ts`:
  - SHA-1 via `node:crypto` `createHash('sha1')`.
  - A fresh upload URL per upload.
  - On a 401 from either B2 call, drop the cached auth, authorize once more, and retry from `get_upload_url`.
- `Dockerfile`: `ENV NODE_ENV=production PORT=3000 BODY_SIZE_LIMIT=12M`.
- `docker-compose.yml`: add `- B2_APP_KEY_ID=${B2_APP_KEY_ID:-}` and the same for the other three, with a comment that cover upload stays hidden until all four are set.
- `.env.example`: add the four keys, empty, with a comment: Bruinen's own key, limited to the covers bucket, with only `writeFiles`.
- `README.md`, under **Covers**:
  - how to create that key in the Backblaze console
  - covers are replaced in place
  - B2 keeps old versions per the bucket's lifecycle settings
  - other devices may show the old cover until their cache drops it

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm test:unit --run src/lib/server/b2.test.ts src/env.test.ts src/lib/server/config.test.ts src/deploy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/b2.ts src/lib/server/b2.test.ts src/env.ts src/env.test.ts src/lib/server/config.ts src/lib/server/config.test.ts Dockerfile docker-compose.yml .env.example README.md src/deploy.test.ts
git commit -m "feat: Add a B2 upload client and its configuration."
```

### Task 4: replaceCover

**Files:**

- Create: `src/lib/covers.ts` (shared by client and server)
- Create: `src/lib/server/cover.ts`
- Test: `src/lib/covers.test.ts`, `src/lib/server/cover.test.ts`

**Interfaces:**

- Consumes:
  - `coverPath`, `ownCoverPath`, `publicUrl` (Task 1)
  - `isJpeg`, `stripMetadata`, `InvalidJpegError` (Task 2)
  - `B2Client`, `B2Error` (Task 3)
  - `updateRecord`, `UpdateTarget` (`src/lib/server/update.ts`)
- Produces (`src/lib/covers.ts`):
  - `MAX_COVER_BYTES = 10 * 1024 * 1024`
  - `COVER_MESSAGES = { notJpeg: 'Choose a JPEG image.', tooBig: 'The image must be 10 MB or smaller.', uploadFailed: "Couldn't upload the cover. Try again." } as const`
  - `coverFileError(file: { type: string; size: number } | null | undefined): string | null`. For the browser check: a missing or empty file, or a type other than `image/jpeg`, gives `notJpeg`; over the cap gives `tooBig`.
- Produces (`src/lib/server/cover.ts`):
  - `interface CoverTarget extends UpdateTarget`, whose `collection(name)` also has `getList(page: number, perPage: number, options: { filter: string; fields: string }): Promise<{ items: { id: string }[] }>`
  - `type CoverResult = { kind: 'updated'; url: string } | { kind: 'invalid'; message: string }`
  - `replaceCover(deps: { b2: B2Client; pb: CoverTarget }, def: CollectionDef, record: Record<string, unknown> & { id: string }, bytes: Uint8Array): Promise<CoverResult>`

- [ ] **Step 1: Write the failing tests**

`covers.test.ts`, the `coverFileError` cases:

- `null` and size 0 give `notJpeg`
- `image/png` gives `notJpeg`
- `image/jpeg` at `MAX_COVER_BYTES` gives `null`
- `image/jpeg` at `MAX_COVER_BYTES + 1` gives `tooBig`

`cover.test.ts`, with fake `b2` (prefix `P = 'https://dl.example/file/covers/'`, records `upload` calls) and fake `pb` (records `getList`/`update`). Valid bytes come from `jpeg([])` in `tests/fixtures/jpeg.ts`.

- `'uploads the stripped file and saves its URL'`: books `{ id: 'b1', title: 'Dune', cover: '' }`.
  - `upload` is called with `('Books/Dune.jpeg', stripMetadata(bytes))`
  - `update` is called with `('b1', { cover: P + 'Books/Dune.jpeg' })`
  - the result is `{ kind: 'updated', url: P + 'Books/Dune.jpeg' }`
- `'replaces in place without a record update when the URL is unchanged'`: with `cover: P + 'Books/Dune.jpeg'`, `upload` is called with the same path and `update` is not called.
- `'checks for other records using the URL'`: `getList(1, 2, { filter: 'cover = "<url>"', fields: 'id' })`. Build the filter with JSON string quoting.
- `'uses its own file when another record shares the cover'`: `getList` returns `[{ id: 'b1' }, { id: 'b2' }]`, so the upload path is `'Books/Dune-b1.jpeg'` and `update` gets that URL. A list holding only `b1` itself does not trigger the fallback.
- `'refuses non-JPEG, oversized and unparseable files before uploading'`:
  - PNG bytes give `{ kind: 'invalid', message: 'Choose a JPEG image.' }`
  - `MAX_COVER_BYTES + 1` bytes starting `FF D8 FF` give the `tooBig` message
  - `FF D8 FF E0` followed by garbage gives `notJpeg`

  None of these calls `upload` or `getList`.

- `'reports a B2 failure without touching the record'`: `upload` rejects with `B2Error`, giving the `uploadFailed` message and no `update`.
- `'reports a record update failure'`: `update` rejects with `ClientResponseError` 400, giving `{ kind: 'invalid', message: 'Please fix the highlighted fields.' }` (from `updateRecord`). Status 404 rethrows.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:unit --run src/lib/covers.test.ts src/lib/server/cover.test.ts`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Implement both modules**

`replaceCover` order:

1. size check
2. `isJpeg` check
3. `stripMetadata`, mapping `InvalidJpegError` to `notJpeg`
4. `prefix = await b2.publicPrefix()`
5. `coverPath`, then the shared check, then `ownCoverPath` when shared
6. `upload`, mapping `B2Error` to `uploadFailed`
7. `updateRecord` only when the URL differs from `record.cover`

`B2Error` thrown by `publicPrefix` also maps to `uploadFailed`.

- [ ] **Step 4: Run them to see them pass**

Run: `pnpm test:unit --run src/lib/covers.test.ts src/lib/server/cover.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/covers.ts src/lib/covers.test.ts src/lib/server/cover.ts src/lib/server/cover.test.ts
git commit -m "feat: Replace a record's cover in B2 and save its link."
```

### Task 5: Cover control on the record page

**Files:**

- Modify: `src/routes/[collection]/[id]/+page.server.ts` (`load`, new `actions.cover`)
- Modify: `src/routes/[collection]/[id]/+page.svelte`
- Create: `src/lib/components/CoverUpload.svelte`
- Create: `src/lib/cover-cache.ts`
- Modify: `src/service-worker/index.ts` (only to share the cache name; see Step 3)
- Create: `tests/e2e/mock-pb/b2.ts`
- Modify: `tests/e2e/mock-pb/server.ts`, `tests/e2e/mock-pb/seed.ts`, `playwright.config.ts`
- Create: `tests/e2e/fixtures/cover-40x60.jpeg`, `tests/e2e/fixtures/cover-60x40.jpeg`, `tests/e2e/fixtures/cover.png`
- Create: `tests/e2e/cover.spec.ts`
- Modify: `tests/e2e/a11y.spec.ts`

**Interfaces:**

- Consumes:
  - `replaceCover`, `CoverResult` (Task 4)
  - `b2()` (Task 3)
  - `coverFileError`, `COVER_MESSAGES` (Task 4)
- Produces:
  - `load` also returns `canUploadCover: boolean`, which is `def.image === 'cover' && b2() !== null`
  - `actions.cover` success: `{ cover: { kind: 'updated', url: string } }`
  - `actions.cover` failure: `fail(400, { cover: { message: string } })`. Every cover result has a `cover` key; edit results never do.
  - `refreshCachedImage(url: string): Promise<void>` in `src/lib/cover-cache.ts`
  - `CoverUpload.svelte` props: `{ hasCover: boolean; error?: string }`

- [ ] **Step 1: Make the e2e fixtures and mock B2**

```bash
magick -size 40x60 xc:'#c33' tests/e2e/fixtures/cover-40x60.jpeg
magick -size 60x40 xc:'#33c' tests/e2e/fixtures/cover-60x40.jpeg
magick -size 40x60 xc:'#3c3' tests/e2e/fixtures/cover.png
```

`tests/e2e/mock-pb/b2.ts` exports `handleB2(state, req, res, url): Promise<boolean>`. `handle` in `server.ts` calls it first, before the body is read as JSON. Routes:

- `GET /b2api/v2/b2_authorize_account`: Basic auth must be `test-key-id:test-key`, else 401. Returns `{ apiUrl: MOCK_ORIGIN, downloadUrl: MOCK_ORIGIN, authorizationToken: 'b2-account' }`.
- `POST /b2api/v1/b2_get_upload_url`: needs token `b2-account` and `bucketId: 'bucket-test'`. Returns `{ uploadUrl: MOCK_ORIGIN + '/b2-upload', authorizationToken: 'b2-upload' }`.
- `POST /b2-upload`: needs token `b2-upload` and `X-Bz-Content-Sha1` matching the body. Stores the body in `state.b2` (`Map<string, Buffer>`, keyed by the decoded `X-Bz-File-Name`).
- `GET /file/bruinen-covers/<path>`: serves the stored bytes as `image/jpeg` with `cache-control: max-age=86400`, or 404.

`freshState()` seeds `state.b2` with `cover-40x60.jpeg` at `Games/Hollow_Knight.jpeg` and `Books/Nineteen_Eighty-Four.jpeg`. `seed.ts` sets those records' covers to `` `${MOCK_ORIGIN}/file/bruinen-covers/<path>` ``. Kindred gets the same URL as Nineteen Eighty-Four (shared). Dune keeps `cover: ''`.

`playwright.config.ts` app `env` adds:

- `B2_APP_KEY_ID: 'test-key-id'`
- `B2_APP_KEY: 'test-key'`
- `B2_BUCKET_ID: 'bucket-test'`
- `B2_BUCKET_NAME: 'bruinen-covers'`
- `B2_API_URL: MOCK_PB`
- `BODY_SIZE_LIMIT: '12M'`

- [ ] **Step 2: Write the failing e2e tests** (`tests/e2e/cover.spec.ts`)

Read the cover's size with `page.getByTestId('cover-frame').locator('img').evaluate((i) => i.naturalWidth)`.

- `'replaces a cover in place'`:
  1. Open Hollow Knight. Poll until `naturalWidth` is 40.
  2. Poll until `bruinen-images` holds the URL (reuse `cachedUrls` from `service-worker.spec.ts`: move it to `helpers.ts`).
  3. `setInputFiles` with `cover-60x40.jpeg`.
  4. Expect the status `Cover updated`, the `img` `src` unchanged, and `naturalWidth` 60.
  5. `page.reload()`, then `naturalWidth` is still 60.
- `'adds a cover to a record without one'`: Dune shows **Add cover**. After upload, the `img` `src` ends with `/file/bruinen-covers/Books/Dune.jpeg`, and the button reads **Replace cover**.
- `'gives a record its own file when it shares one'`: Nineteen Eighty-Four's new `src` ends with `Books/Nineteen_Eighty-Four-<its id>.jpeg`. Kindred's page still shows `…/Books/Nineteen_Eighty-Four.jpeg` with `naturalWidth` 40.
- `'refuses a PNG labelled as JPEG'`:
  - `setInputFiles({ name: 'x.jpeg', mimeType: 'image/jpeg', buffer: <cover.png bytes> })` shows "Choose a JPEG image." next to the button.
  - The cover is unchanged.
  - The `dialog` named `/^Edit /` is not visible.
- `'refuses a PNG and an oversized file in the browser'`:
  - `cover.png` shows "Choose a JPEG image."
  - A `MAX_COVER_BYTES + 1` buffer of `image/jpeg` shows "The image must be 10 MB or smaller."
  - `state.b2` is unchanged. Add `GET /__mock/b2` listing the keys, and assert on it.
- `'shows no cover control where there is no cover field'`: a `read_later` record and an `mtg` record have no **Add cover** or **Replace cover** button.

In `a11y.spec.ts`, add to the axe sweep and the 44px target check:

- the Hollow Knight record page with the control
- the same page showing the "Choose a JPEG image." error

Run: `pnpm test:e2e tests/e2e/cover.spec.ts --project=chromium`
Expected: FAIL. There is no Replace cover / Add cover control.

- [ ] **Step 3: Implement**

- `actions.cover`:
  1. 404 unless `def.image === 'cover'` and `b2()` is set.
  2. `form.get('cover')` must be a non-empty `File`, else `fail(400, { cover: { message: COVER_MESSAGES.notJpeg } })`.
  3. `getOne(params.id)`.
  4. `replaceCover({ b2, pb: locals.pb }, def, record, new Uint8Array(await file.arrayBuffer()))`.
  5. Map the result to the shapes above.
- `+page.svelte`:
  - Render `<CoverUpload hasCover={Boolean(image)} error={coverFailure?.message} />` under `<Cover>` when `data.canUploadCover`.
  - Edit's `failure` becomes `form && !('updated' in form) && !('cover' in form) ? form : null`.
  - Show `<Toast message="Cover updated" />` inside the existing `{#key form}` when `form?.cover?.kind === 'updated'`.
  - Wrap `<Cover>` in `{#key coverVersion}`, bumped after a successful upload.
- `CoverUpload.svelte`:
  - A `<form method="POST" action="?/cover" enctype="multipart/form-data" use:enhance>`.
  - A file input `name="cover"`, `accept="image/jpeg"`, with a visible button-styled label: **Replace cover** / **Add cover** (44px target).
  - With JS, `change` runs `coverFileError`. It shows the error, or calls `requestSubmit()`. While pending the label reads **Uploading…** and the input is disabled.
  - On a success result: `await refreshCachedImage(url)`, bump the key, then `await update()`.
  - Without JS: an **Upload** submit button, hidden once hydrated.
  - The error is a `<p>` tied to the input with `aria-describedby`.
- `refreshCachedImage(url)`:
  1. `caches.open('bruinen-images')` and `.delete(url)`, inside `try` (`caches` may be missing).
  2. `await fetch(url, { mode: 'no-cors', cache: 'reload' })`, inside `try`.

  Share the `'bruinen-images'` name with `IMAGE_CACHE` in `src/service-worker/index.ts`: export it from `src/lib/cover-cache.ts` and import it in the worker if `pnpm check` (which runs `tsc -p src/service-worker`) accepts that. Otherwise leave a cross-reference comment at both places. If the e2e test shows the old image is still served from the document's memory cache after this, find a fix that keeps the `src` unchanged. The e2e test is the gate. Ledger the ruling.

- [ ] **Step 4: Run e2e and the full suite**

Run: `pnpm test:e2e tests/e2e/cover.spec.ts tests/e2e/a11y.spec.ts`
Expected: PASS on chromium and mobile-webkit

Run: `pnpm check && pnpm lint && pnpm test:unit --run && pnpm test:e2e`
Expected: all green. The seed change must not break `cards`, `browse` or `service-worker` specs. Where one asserted the old `COVER_OK` on these four records, update it.

- [ ] **Step 5: Commit**

```bash
git add -A src tests playwright.config.ts
git commit -m "feat: Replace covers from the record page."
```

## Manual check (after the branch is green, with the user's go-ahead)

This writes real data to B2 and Rivendell. The user picks the record.

1. Set Bruinen's own B2 key in `.env` and run `pnpm dev` against the tailnet `POCKETBASE_URL`.
2. On the chosen record, confirm its current `cover` starts with the prefix B2 reports (`{downloadUrl}/file/{bucket}/`). If Rivendell's covers use another host, stop and report it: the reuse rule would need that prefix too.
3. Replace its cover with a phone photo. Check that the link is unchanged and the new image shows.
4. Download the B2 file and check that it has no GPS EXIF (`sips -g all` or `magick identify -verbose`).
