# Cover upload — replace a record's cover from Bruinen

## Intent

Rivendell's enrichers fetch a cover when a record is created. Sometimes the cover they find is the
wrong image, and sometimes they find none. Today the only fix is to upload a file to B2 by hand and
paste its URL into the PocketBase admin. Bruinen should take a JPEG and do the rest: upload it to B2,
build the public link, and save it on the record.

This is a repair tool for records that already exist. It is not part of creating a record.

## Goals

- From a record's page, pick a JPEG and have it become that record's cover in one step.
- Store it in the same B2 bucket and folder layout Rivendell uses, so the covers stay consistent.
- Replace the cover file in place: a new upload keeps the existing file name, so the record's link
  stays the same.
- Show the new cover immediately on the device that uploaded it.

## Non-goals

- Uploading a cover while creating a record. Rivendell's enrichers run after create and overwrite
  `cover`, so an uploaded cover would be lost. Create first, then replace the cover.
- MTG cards. Their `image`/`back` are text fields filled from the card lookup; out of scope.
- Resizing, cropping, re-encoding or converting images. The image data goes to B2 untouched; only
  metadata is removed (see Metadata).
- Formats other than JPEG.
- Clearing a cover, or deleting old cover files from B2.
- Changing Rivendell. Bruinen talks to B2 directly; Rivendell only sees a normal record update.

## Anti-goals

- Bruinen must never delete a file in B2. Replacing a cover uploads a new version under the same
  name; B2 keeps the old version as a hidden older version, and the bucket's lifecycle settings
  (not Bruinen) decide whether it is ever removed.
- Replacing one record's cover must never change another record's cover (see File name).
- The B2 key must never reach the browser. All B2 calls happen on the Bruinen server.
- Bruinen must not reuse Rivendell's B2 key. It gets its own, limited key (see Configuration).

## Constraints (verified)

- **Collections:** `cover` is a URL field on `books`, `cds`, `games`, `movies`, `shows`,
  `vinyls` (the `IMAGE_COLLECTIONS` list in `src/lib/collections.test.ts`). These six get the feature.
- **Rivendell has no update hook.** A PATCH of `cover` is stored as is and triggers no enrichment
  (see the edit-records work on `feat/edit-records`, which this feature builds on).
- **Rivendell's B2 flow** (`~/Repos/rivendell/helpers/uploadToB2.go`), native B2 API v2:
  1. `GET https://api.backblazeb2.com/b2api/v2/b2_authorize_account` with
     `Authorization: Basic base64(keyId:key)` → `apiUrl`, `authorizationToken`, `downloadUrl`.
     Rivendell caches this for 12 hours.
  2. `POST {apiUrl}/b2api/v1/b2_get_upload_url` with `{ "bucketId": ... }` → `uploadUrl`,
     upload `authorizationToken`. (Rivendell calls v1 here; v2 takes the same request. Builder's
     call.)
  3. `POST {uploadUrl}` with the file as the body and headers `Authorization` (upload token),
     `X-Bz-File-Name` (URL-encoded path), `Content-Type: image/jpeg`, `Content-Length`,
     `X-Bz-Content-Sha1` (hex SHA-1 of the body), `X-Bz-Info-Author`.
  4. Public URL: `{downloadUrl}/file/{bucketName}/{fileName}`.
- **Rivendell's folder and file names** (`enrichers.go`, `uploadToB2.go` `pathMap`):
  - Folder: books→`Books`, cds→`CDs`, games→`Games`, movies→`Movies`, shows→`Shows`,
    vinyls→`Vinyls`.
  - Name (`enrichers.go:423-430` for movies and shows):
    - books, games: `FileNameFmt(title)`
    - cds, vinyls: `FileNameFmt(album)`
    - shows: `FileNameFmt(title)-s%02d` when `season > 0`, otherwise `FileNameFmt(title)`
    - movies: `FileNameFmt(title)-{year}`. Rivendell uses TMDB's year and can produce `Title-.jpeg`
      when it is empty. Bruinen uses the record's `year` and leaves `-{year}` off when it is 0 or
      missing. (My call: this only applies to records without a cover in the bucket, since an
      existing cover's path is reused as is; see File name.)
  - Extension: `.jpeg`.
  - `FileNameFmt` is in `~/Repos/rivendell/utils/fileNameFmt.go` (the `emojiRange` regex lives in
    the same package). Its tests are the `TestFileNameFmt` table in
    `~/Repos/rivendell/utils/utils_test.go`; the TypeScript port copies those cases.
- **Request size.** adapter-node rejects request bodies over `BODY_SIZE_LIMIT`, default `512K`
  (`node_modules/@sveltejs/adapter-node/src/handler.js`). Phone photos are several MB. The Vite dev
  server does not enforce this limit, so it only bites in production.
- **Service worker.** `src/service-worker/index.ts` caches covers cache-first by URL
  (`bruinen-images`) and never re-checks them; the browser's HTTP cache may hold them too. A
  replacement at the same URL keeps showing the old image until something clears those copies.
- **Env vars** are declared in `src/env.ts` with `defineEnvVars` and read from `$app/env/private`
  (see `src/lib/server/config.ts`).

## Approaches considered

- **A. Browser resizes to a JPEG, Bruinen uploads it.** Small, uniform files; any input format.
  Not picked: the user wants the file stored as is.
- **B. Bruinen uploads the original file, JPEG only. (Picked.)** Simplest; the picture is exactly
  what the user chose. Costs larger files (several MB from a phone) and a raised body size limit.
  After the builder check, the user also chose to strip metadata before upload (see Metadata).
- **C. Browser uploads straight to B2 with a short-lived URL from Bruinen.** Large files skip the
  Bruinen server. Not picked: needs bucket CORS and an S3-style key, and breaks the rule that the
  browser only talks to Bruinen.

The user picked B and restricted it to JPEGs.

## Design

### Where it lives (decided by the user)

On the record page (`src/routes/[collection]/[id]/+page.svelte`), under the cover, for the six
collections above:

- A **Replace cover** button when the record has a cover, **Add cover** when it doesn't.
- Picking a file uploads and saves right away. No separate Save step, and it is not part of the
  Edit dialog.
- On success, the page reloads its data, the new cover shows, and a toast says **Cover updated**.
- While uploading, the button shows **Uploading…** and is disabled.
- On failure, an error message shows next to the button and the cover is unchanged.

The button is hidden when B2 is not configured (see Configuration), so Bruinen still runs without
B2, for example in development.

### Upload rules

- **JPEG only.** The file input uses `accept="image/jpeg"`. The server checks the file's first three
  bytes are `FF D8 FF`; the browser's type label is not trusted. Anything else fails with
  "Choose a JPEG image."
- **Size cap: 10 MB.** Over the cap fails with "The image must be 10 MB or smaller." With JS, the
  browser checks the type and size before sending, so a bad file fails without an upload.
- **No file chosen** (possible without JS) fails with "Choose a JPEG image."
- `BODY_SIZE_LIMIT` is raised to `12M` in the `Dockerfile` and `docker-compose.yml`, so the
  server's own 10 MB check is the one that answers. Every other form stays tiny, so this does not
  change them.

### Metadata (decided by the user)

The bucket allows public reads, and phone photos usually carry EXIF data with GPS coordinates. So
before upload, the server removes metadata from the JPEG without re-encoding it: it walks the
JPEG's marker segments up to the start of scan and drops some of them. The scan data and
everything after it are copied unchanged, so the picture is pixel-identical.

- **Dropped:** APP1 (EXIF and XMP), APP13 (Photoshop/IPTC), COM (comments), and any other APPn
  segment not listed as kept.
- **Kept:** APP0 (JFIF), APP2 `ICC_PROFILE` (dropping it would shift colors), APP14 `Adobe`
  (needed to decode some color transforms), and every non-APP segment (tables, frame header).
- **Orientation (my call):** phone photos are often stored sideways, with an EXIF Orientation tag
  telling viewers to rotate them. Dropping EXIF would show such a cover sideways. When the original
  Orientation is anything other than 1, the server writes back a minimal APP1 EXIF holding only
  that tag. No other EXIF field survives.
- A file whose segments can't be parsed is refused with "Choose a JPEG image." It is never
  uploaded as is.
- The SHA-1 and size sent to B2 are those of the stripped file.

### File name

A new upload replaces the existing file under the same name (decided by the user). The path is
chosen in this order:

1. **The record already has a cover in this bucket** (its URL starts with
   `{downloadUrl}/file/{bucketName}/`): reuse that exact path, URL-decoded. Rivendell's names don't
   always match what Bruinen would build (movies use TMDB's year, for example), so reusing the
   path is the only way to be sure the existing file is the one replaced.
2. **Otherwise** (no cover, or a cover hosted elsewhere): `{Folder}/{name}.jpeg`, with `{name}`
   from Rivendell's rules above, built with a TypeScript port of `FileNameFmt`. For example
   `Books/Dune.jpeg`. If `{name}` comes out empty (a title with no Latin letters or digits), the
   record ID is used instead.

**Shared files (my call).** Rivendell can give two records the same file, for example two editions
of "Dune". Before uploading, the server checks whether any other record in the collection has a
`cover` equal to the chosen path's public URL. If one does, the path becomes
`{Folder}/{name}-{recordId}.jpeg` instead, so the other record's cover is left alone.

When the resulting URL equals the record's current `cover`, the record is not PATCHed; only the B2
file changes.

### Stale covers (decided by the user)

The link stays the same, so caches must be cleared. Bruinen has a single user, so only the
uploading device is handled:

- After a successful upload, the page deletes the cover's URL from the service worker's
  `bruinen-images` cache, fetches it again bypassing the browser's HTTP cache, and shows the new
  image without a full reload.
- Other devices may keep showing the old cover until their cache evicts it. This is accepted.

### Flow (new `?/cover` form action on the record route)

1. Read the multipart form; check that a file is present, is a JPEG by its bytes, and is within
   10 MB.
2. Strip metadata (see Metadata).
3. Load the record, pick the path (see File name), and check for other records sharing it.
4. Upload the stripped file to B2 (authorize, get an upload URL, upload), as in Constraints.
5. If the URL changed, PATCH the record's `cover` with it through the existing `updateRecord`
   (`src/lib/server/update.ts`).
6. Return a success result the page turns into the toast.

Failures:

- **B2 fails** (network, auth, B2 error): "Couldn't upload the cover. Try again." Nothing changes
  on the record.
- **B2 succeeds but the record update fails:** show the error. The uploaded file stays in B2;
  Bruinen does not delete it.
- **Record gone (404) or Rivendell unreachable:** the existing error page path, like `update`.

### B2 client

A small server-only module (for example `src/lib/server/b2.ts`) with an upload function:
`upload(path, bytes) → public URL`. It uses `fetch`; no new dependency.

- Cache the authorization in memory (Rivendell uses 12 hours). If B2 answers `401` with an
  expired token, authorize again once and retry.
- Get a fresh upload URL for each upload.
- Set `X-Bz-Info-Author: bruinen` so B2 shows which app wrote the file.
- Accept the API base URL from config, defaulting to `https://api.backblazeb2.com`, so tests can
  point it at a mock.

### Configuration

New env vars in `src/env.ts`, all server-only:

| Var              | Meaning                                |
| ---------------- | -------------------------------------- |
| `B2_APP_KEY_ID`  | Bruinen's own B2 application key ID    |
| `B2_APP_KEY`     | That key's secret                      |
| `B2_BUCKET_ID`   | Bucket Rivendell's covers live in      |
| `B2_BUCKET_NAME` | Same bucket's name, for the public URL |

B2 counts as configured only when all four are set. `docker-compose.yml` passes them through from
`.env`. The README explains how to create the key in the Backblaze console: limited to this one
bucket, with only the `writeFiles` capability.

### Tests

- **Unit:** the `FileNameFmt` port (every case from Rivendell's `TestFileNameFmt`, plus an
  all-stripped title), the name rules per collection (show with and without a season, movie with
  and without a year, empty name), path choice (reuse a bucket path, build one for no cover or a
  foreign cover, fall back to `-{recordId}` when another record shares the file), the JPEG and size checks, metadata stripping (EXIF with GPS
  removed, XMP and comments removed, ICC and JFIF kept, scan data byte-identical, Orientation 6
  kept as a minimal EXIF, Orientation 1 or none leaves no APP1, a truncated file refused), and the
  B2 client against a fake `fetch` (headers, SHA-1, URL built, token cached, one re-authorize on
  `401`).
- **E2E:** a mock B2 server next to the mock PocketBase (`tests/e2e/mock-pb/`) that answers the
  three calls and serves uploaded files. Cases:
  - replace a book's cover; the same URL is kept, the new image shows without a reload (not the
    cached old one), and the toast says Cover updated
  - add a cover to a record without one; it gets the built name
  - a record sharing its cover file with another gets its own `-{recordId}` file, and the other
    record's cover is unchanged
  - a PNG is refused
  - a file over 10 MB is refused
  - the button is hidden for collections without covers
  - the cover control passes the existing axe and 44px target checks in `a11y.spec.ts`

## Left to the builder

- How the button, hidden file input and auto-submit are built, including the no-JS fallback
  (a visible file input and an Upload button is fine).
- The shape of the action's success and failure results, and how the page tells this action's
  result apart from the Edit action's.
- Where the `FileNameFmt` port and the name rules live.
- How the page clears the cached cover and refreshes the image.
- Confirming during the manual check that real cover URLs start with the authorize call's
  `downloadUrl`. If Rivendell's covers use another host, the reuse rule needs that prefix too.
- Whether the record page gets "B2 configured" from `load` or another way.
- Mock B2 details.
