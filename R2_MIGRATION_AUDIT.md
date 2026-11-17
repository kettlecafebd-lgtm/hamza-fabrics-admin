# Supabase → Cloudflare R2 Migration Audit

**Scope:** Supabase Storage SDK usage, upload/download proxying, and backend logging in the
Hamza Fabrics admin stack (`hamza-backend` + this Vite frontend).
**Date:** 2026-11-17
**Verdict:** every code path that could write media to Supabase Storage, or pull object bytes
back through our own process, has been removed. Media now goes browser → R2 directly, or
backend → R2 in the one controlled fallback. All 74 backend tests pass (`npm test`), the
frontend builds, and the 41 frontend media self-checks pass (`node scripts/media-selftest.mjs`).

---

## 1. Summary — what was actually wrong

The Supabase bill had **three independent causes**, and only one of them was "we store files in
Supabase Storage".

| # | Cause | Where | Cost driver |
|---|-------|-------|-------------|
| 1 | Objects were read/written through the Supabase Storage SDK | `hamza-backend/src/services/mediaStorage.js` | Storage **egress** + one logged Storage request per object |
| 2 | `POST /api/media/cache-control` **downloaded and re-uploaded every object** just to change a header | same file | 2 Storage requests + a full copy of the bytes per image |
| 3 | Every upload was POSTed as multipart **through the backend** | 4 frontend pages → `/api/upload-image` | Backend ingress/egress; the file then landed in Supabase anyway |

And two causes for the **log-ingestion** line specifically:

| # | Cause | Where |
|---|-------|-------|
| 4 | One `info` record per stored chat message (thousands/day, zero signal) | `mediaIngestService.js`, `refreshMedia.js` |
| 5 | `client.auth.getUser()` on **every** API request — one Supabase Auth call per request, and the inbox fires dozens per screen | `middleware/auth.js` |

Nothing in the **frontend** ever imported a Supabase SDK — the browser never talked to Supabase
directly. It posted files to our own backend and rendered whatever URL came back, which is why
the fix belongs in the backend plus the upload call sites.

---

## 2. Files that needed modification

Legend: **A** = added, **M** = modified, **U** = unchanged but audited and confirmed clean.

### Backend — storage layer

| File | | Why it changed |
|------|---|----------------|
| `hamza-backend/src/services/r2Storage.js` | **A** | The R2 driver: presigned PUTs, batched deletes, metadata-only Cache-Control rewrites, key/path validation. |
| `hamza-backend/src/services/mediaStorage.js` | **M** | Now a *facade* that selects a driver. The Supabase SDK code survives only as an opt-in legacy driver that can delete but **cannot write new bytes**. |
| `hamza-backend/src/routes/uploads.js` | **A** | `POST /api/media/presign` (direct-to-R2) and the legacy `POST /api/upload-image` multipart shape, both writing to R2. |
| `hamza-backend/src/routes/media.js` | **M** | Delete uses one batched R2 request; cache-control is metadata-only; responses report `driver`; added `GET /api/media/config`. |
| `hamza-backend/src/config/env.js` | **M** | R2 settings, presign TTL, upload ceiling, logging flags, and boot-time validation that *warns* rather than killing webhook ingestion. |
| `hamza-backend/src/db/supabase.js` | **U** | Still used — for **Postgres** (chat rows, `media_references`), never for storage. |
| `hamza-backend/package.json` | **M** | Added `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. |

### Backend — logging / log ingestion

| File | | Why it changed |
|------|---|----------------|
| `hamza-backend/src/middleware/requestLogger.js` | **A** | Opt-in request logging that skips `/api/chat/media/*` and probes; production guard clamping `LOG_LEVEL=debug`. |
| `hamza-backend/src/middleware/auth.js` | **M** | Caches verified admin tokens until their own `exp` (max 5 min), keyed by SHA-256 — removes a Supabase Auth round-trip per request. |
| `hamza-backend/src/services/mediaIngestService.js` | **M** | Per-message lines are `debug` unless `LOG_MEDIA_EVENTS=true`. |
| `hamza-backend/src/routes/refreshMedia.js` | **M** | URL-refresh chatter → `debug`. |
| `hamza-backend/src/app.js` | **M** | Wires the storage facade, one auth pass for `/api/media`, upload routes, `/health` reports the driver, log-level guard. |
| `hamza-backend/src/server.js` | **M** | Boot reports the media driver and warns if Supabase is still active. |

### Frontend — upload call sites

| File | | Why it changed |
|------|---|----------------|
| `src/lib/mediaClient.js` | **M** | New `uploadMedia()`: presign → direct PUT to R2, with a transparent multipart fallback. |
| `src/pages/Products.jsx` | **M** | Main/variant/review images upload to R2 *first*; the product request carries only URLs. Also fixes an ordering bug: the variant/review JSON was serialised **before** the uploads, so a URL assigned afterwards was silently dropped. |
| `src/pages/Settings.jsx` | **M** | Logo / favicon / hero / footer banners upload straight to R2. |
| `src/components/ProfileSettings.jsx` | **M** | Avatar uploads straight to R2. |
| `src/pages/ResolutionCenter.jsx` | **M** | Evidence photos go to R2; the claim carries `image_urls` JSON instead of multipart files. |
| `src/utils/imageUrl.js` | **M** | Thumbnails now prefer Cloudflare Image Resizing in front of R2; Supabase transforms demoted to a legacy flag. |
| `src/config/app.js` | **M** | The `console.info` banner no longer runs in production. |
| `src/context/ThemeContext.jsx`, `src/components/Orders/OrderTable.jsx` | **M** | One stray `console.log` → `console.warn` with context; consistent prefixes. |

### Frontend — confirmed clean (no changes needed)

`BulkProductUpload.jsx` (uploads a **CSV**, not media — `imageUrl` there is a text column in the
sheet), `BulkUpload.jsx`, `chatMedia.js`, `ChatThread.jsx`, `ChatMedia.jsx` (chat media is already
URL-only and 302-redirected), and `smartRestock/ComboBuilder/OrderTable/VariantMatrix` (already
use `thumbUrl`).

---

## 3. The new data flow

### Upload (zero bytes through the backend)

```
browser  ──POST /api/media/presign { folder, fileName, contentType, size }──▶  backend
         ◀── { uploadUrl, headers, url, key } ──┘        (one small JSON call, no payload)

browser  ──PUT file + signed headers──────────────────────────────────────▶  Cloudflare R2
         (browser → R2 directly; ingress/egress on our backend: 0)

browser  ──GET https://media.hamzafabrics.com/products/shirt-abc.webp───▶  Cloudflare edge
         (cached for a year; Supabase egress: 0)
```

The presigned URL is bound to `Content-Type` and `Cache-Control: public, max-age=31536000,
immutable`, so the object cannot be stored with the wrong type or a revalidating cache header.
That is only safe because keys are content-addressed (`shirt-abc-3f9a1c0b.webp`) — new bytes
always produce a new key.

### Cache-Control backfill (was: download + re-upload)

```js
// BEFORE — Supabase had no metadata-only update
const { data: blob } = await api.download(key);      // egress: whole object
await api.upload(key, blob, { upsert: true, cacheControl });  // egress: whole object again

// AFTER — R2 is S3-compatible, so this is metadata only
await s3.send(new HeadObjectCommand({ Bucket, Key }));           // ~0 bytes
await s3.send(new CopyObjectCommand({ Bucket, Key, CopySource,   // server-side
  MetadataDirective: 'REPLACE', CacheControl: 'public, max-age=…' }));
```

A test asserts `GetObjectCommand` is **never** called in this flow.

### Deletes

`media_references` (migration 003) still gates deletion — unchanged, still fail-closed. What
changed is the number of requests: one `DeleteObjectsCommand` for the whole batch instead of one
`storage.remove()` per URL.

---

## 4. Requirement-by-requirement

### 1. Identify every file importing Supabase storage / handling uploads/downloads

| Location | Before | After |
|---|---|---|
| `src/services/mediaStorage.js:180` | `client.storage.from(bucket)` | Only inside `createSupabaseStorage()` (legacy driver) |
| `src/services/mediaStorage.js:244–252` | `api.download()` + `api.upload()` | Removed from the default path; exists only in the legacy driver |
| `src/db/supabase.js` | `createClient` (also used for storage) | Postgres only |
| `src/routes/media.js` | delete / cache-control via storage SDK | Driver-agnostic; batched |
| `src/routes/uploads.js` | *did not exist* | Presign + multipart, both → R2 |
| `src/lib/mediaClient.js` (frontend) | `fetch('/api/upload-image')` with `FormData` | `uploadMedia()` → presign → direct PUT |
| `Products.jsx`, `Settings.jsx`, `ProfileSettings.jsx`, `ResolutionCenter.jsx` | multipart with binary parts | URLs only |
| `src/utils/imageUrl.js` | Supabase render-endpoint rewrite | Cloudflare in front of R2, Supabase behind a legacy flag |

Confirmed **zero** `@supabase/supabase-js` imports in `src/`, and no `storage.from`, `.upload`,
`getPublicUrl`, or `createSignedUrl` anywhere outside the legacy driver.

### 2. Rewrite upload + public URL generation to point at R2

- **Upload:** `POST /api/media/presign` → presigned `PutObjectCommand` (`r2Storage.js:presignUpload`).
- **Public URL:** `${R2_PUBLIC_BASE_URL}/${key}`, generated by `publicUrl()` — never a Supabase
  `/storage/v1/object/public/...` path.
- **Server-side fallback:** `putObject()` writes to R2 when direct uploads are disabled.
- **Legacy compatibility:** `/api/upload-image` still answers `{ success: true, url }`, so no page
  needed a rewrite to stop using Supabase.

### 3. No media or large payloads proxied through the backend/Supabase

- Direct uploads: the file never reaches the backend process.
- Delivery: `R2_PUBLIC_BASE_URL` is a different origin from the API — R2 and the CDN serve it.
- The **only** remaining server-side byte path is the explicit multipart fallback
  (`MEDIA_DIRECT_UPLOAD_ENABLED=false`), which is bounded by `MEDIA_UPLOAD_MAX_BYTES` and writes
  to R2, not Supabase.
- Chat media was already URL-only; `chat_messages` selects an explicit column allowlist and never
  touches a binary column (`messageRepository.js`).
- `nginx` still proxies `/uploads/` for **legacy disk** files only; the R2 driver rejects those
  URLs with `reason: 'legacy-disk'` rather than trying to delete them.

### 4. Clean up redundant logging

| Change | Effect |
|---|---|
| Per-message `info` → `debug` (opt-in via `LOG_MEDIA_EVENTS`) | Removes the largest single source of log lines |
| Request logging is opt-in and skips `/api/chat/media/*`, `/health`, config probes | A 50-image thread logs **0** lines instead of 50 |
| Cache-control / delete sweeps `info` → `debug` | Each sweep used to log a line per request |
| HTTP success → `debug`, 4xx → `warn`, 5xx → `error` | Failures stay, noise goes |
| `LOG_LEVEL=debug`/`silent` in production is clamped to `info` with a warning | A leftover debug session cannot reinstate the bill |
| Admin token cache (SHA-256 keyed, `exp`-bounded, ≤5 min) | Removes one Supabase Auth call per request |
| `console.info` app-config banner → dev-only `console.debug` | One fewer line per production page load |
| Storage-deprecation warning emitted **once at boot**, not per factory call | No duplicate lines |

---

## 5. Configuration

```bash
# hamza-backend/.env — required
R2_BUCKET=hamza-media
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...                       # or R2_ENDPOINT=...
R2_PUBLIC_BASE_URL=https://media.hamzafabrics.com

# optional
MEDIA_DIRECT_UPLOAD_ENABLED=true        # false = multipart fallback to R2
MEDIA_PRESIGN_TTL_SECONDS=300
MEDIA_UPLOAD_MAX_BYTES=10485760
MEDIA_STORAGE_DRIVER=                   # blank = R2 when configured
LOG_LEVEL=info
LOG_MEDIA_EVENTS=false
LOG_HTTP_REQUESTS=false
```

```bash
# frontend .env
VITE_MEDIA_PUBLIC_BASE_URL=https://media.hamzafabrics.com
VITE_CDN_IMAGE_TRANSFORMS=false         # true once the zone has a resize rule
```

**Bucket CORS is required** for direct uploads — see `hamza-backend/r2-cors.json`:

```bash
npx wrangler r2 bucket cors put hamza-media --file hamza-backend/r2-cors.json
```

`AllowedHeaders` must include `Cache-Control`, otherwise the preflight fails and every upload
falls back to multipart (correct, but slower). `allowedHosts`/origins must be the **admin app**
origin, not the API.

---

## 6. Rollout order

1. **Create the R2 bucket** + S3 API token; set `R2_PUBLIC_BASE_URL` (custom domain recommended —
   `r2.dev` is rate-limited and not for production).
2. **Apply the CORS policy.** Without it, direct uploads 503 and the client falls back to
   multipart — degraded but working.
3. **Deploy the backend** with the R2 vars. Check `GET /health` → `mediaDriver: "r2"`,
   `warnings: []`.
4. **Deploy the frontend.** New uploads land in R2; new URLs are R2 URLs.
5. **Verify**: upload a product image, inspect the response URL (must be
   `https://media.hamzafabrics.com/...`), then `curl -I` it and confirm
   `cache-control: public, max-age=31536000, immutable`.
6. **Backfill old objects** (optional, see §7) — existing rows still point at Supabase URLs, which
   keep working until backfilled.
7. **Drain Supabase Storage**: set `MEDIA_DELETE_ENABLED=true` and
   `MEDIA_STORAGE_DRIVER=supabase` temporarily to delete the old bucket's objects, then remove the
   driver override. `DELETE_BUCKETS` keeps the blast radius to `media,products`.

Steps 1–4 are safe to run in any order; each is independently reversible.

---

## 7. What this refactor does **not** do

- **It does not migrate existing objects.** Rows whose `image_url` already points at
  `<project>.supabase.co/storage/v1/...` keep working and keep costing Supabase egress until
  they are re-pointed. Backfill is a separate job: copy each object to R2 (`aws s3 cp` or a
  Worker/`rclone` job with the R2 S3 endpoint), `UPDATE` the URL column, then delete from
  Supabase **after** verifying `media_references` no longer matches the old key. This is
  deliberately not automated here — a bulk URL rewrite is the one change that can silently blank
  every product photo, and it needs a verified, per-table plan.
- **It does not serve the customer storefront.** `hamza-fabrics-shop` is a separate repo; if it
  renders the same product images it will pick up R2 URLs automatically (they are absolute), but
  its own upload paths — if any — need the same treatment.
- **It does not tune the Supabase project itself** (log drain/retention settings, `pg_stat` verbosity).
  The code-side log volume is fixed; the remaining volume is Postgres/PostgREST/GoTrue access
  logs, which are a dashboard setting.
- **The legacy Supabase driver stays in the tree** on purpose. Deleting it now would strand the
  drain step in §6.7. It cannot write new bytes, and `MEDIA_STORAGE_DRIVER=supabase` is the only
  way to reach it.

---

## 8. Verification performed

| Check | Result |
|---|---|
| `cd hamza-backend && npm test` | **74 passing** (was 48): 18 new R2 tests, 8 new logging-policy tests |
| `node scripts/media-selftest.mjs` | 41/41 checks pass |
| `npm run build` (frontend) | builds clean |
| `npx eslint` on changed files | 37 problems, all pre-existing (baseline 38) |
| Boot with R2 env | `/health` → `mediaDriver: "r2"`, `mediaConfigured: true`, `warnings: []` |
| Anonymous `POST` to `/api/media/presign`, `/api/media/delete`, `/api/upload-image` | **401** on all — no open upload endpoint |
| Presign happy path | URL signed against `acct123.r2.cloudflarestorage.com`, `expiresIn: 300`, immutable Cache-Control header |
| `GetObjectCommand` in the cache-control flow | never called (asserted) |
| `storage.from(` outside the legacy driver | none |

Key regression tests added (`hamza-backend/test/r2-storage.test.js`):

- R2 is chosen as soon as it is configured; Supabase is opt-in only.
- The Supabase driver refuses `putObject`/`presignUpload` with `driver-not-supported`.
- A Cloudflare-transformed thumbnail URL resolves to the same object key as the original (so a
  delete cannot mistake an in-use image for an orphan).
- A legacy Supabase URL is rejected as `foreign-host` by the R2 driver.
- Keys cannot escape the bucket (`..`, `//`, `./`, control characters).
- Presign refuses oversized files, non-image types, and unsafe keys.
- Cache-control uses exactly `HeadObject` + `CopyObject`, never `GetObject`.
- Deletes are one batched request and still respect `media_references`.
- The legacy multipart route writes to R2 and preserves `{ success, url }`.
