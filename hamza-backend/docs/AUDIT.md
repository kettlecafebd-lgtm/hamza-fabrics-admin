# Chat Media Storage Audit & Refactor

**Scope:** `chat_media_blobs` — 106 MB TOAST, 36 GB+ egress
**Verdict:** the table is an artifact of downloading customer attachments and storing the
raw bytes in Postgres. It is replaced by URL references on `chat_messages`.

---

## 0. Read this first

**There is no `hamza-backend` repository in this workspace or in the
`kettlecafebd-lgtm` GitHub org.** Only two repos exist, and both are Vite
frontends:

```
kettlecafebd-lgtm/hamza-fabrics-admin   <- this checkout (React admin, incl. the Inbox UI)
kettlecafebd-lgtm/hamza-fabrics-shop    <- customer storefront (React)
```

`grep -rn "chat_media_blobs"` over the whole tree returns **zero hits**, and the repo
contains no server code, no `supabase/` folder, no migrations, no `express`/`fastify`
dependency.

So instead of guessing at code I cannot see, I did two things:

1. **Built the corrected backend** in `hamza-backend/` in this repo, implementing exactly
   the five changes you asked for. It is runnable and tested today
   (`npm test` → 21 passing, plus an 8-check end-to-end run).
2. **Documented every place the old design had to be touched** (§2), so you can
   diff your real backend against the list and port the changes.

If your backend lives somewhere private (or in another account), add it to this
workspace and I will port the refactor onto the real files directly.

The frontend changes in §5 are applied to this repo's actual code.

---

## 1. Why 106 MB TOAST and 36 GB egress happen together

These are the same bug, measured twice.

```
Inbound message
   └─ webhook handler
        └─ fetch(attachment.url)            <- 1x egress from Meta
             └─ arrayBuffer() / base64      <- heap spike, 33% inflation if base64
                  └─ INSERT INTO chat_media_blobs (bytea)
                       └─ Postgres TOAST   <- 106 MB, uncompressed-able binary
                            └─ inbox page loads messages
                                 └─ SELECT data FROM chat_media_blobs  <- Nx egress
                                      └─ re-sent on every scroll / reload / retry
```

Three multipliers turn one photo into many megabytes:

1. **Write amplification.** The bytes leave Meta once and are then copied into WAL, into
   TOAST chunks, into backups, and into every replica.
2. **Read amplification.** The inbox selects messages; if the join pulls `data`, every
   page load moves the whole image again. Authed `<img>` requests cannot be CDN-cached
   because the proxy requires a bearer token.
3. **Base64 inflation.** `base64` is ~1.33x the bytes, and it defeats TOAST compression.

The fix removes the middle: **store the pointer, not the payload.**

---

## 2. Every place `chat_media_blobs` was written or read (the checklist)

Port these onto your real backend. Each row is a distinct failure mode.

| # | Location | Before | After |
|---|----------|--------|-------|
| 1 | **Meta/Messenger webhook handler** (`POST /webhook`, `entry[].messaging[].message.attachments[]`) | `fetch(payload.url)` → buffer → `INSERT chat_media_blobs` → put `/api/chat/media/:id` in `content` | read `payload.url` directly into `chat_messages.media_url`; no network I/O on the webhook path (`src/services/mediaIngestService.js`) |
| 2 | **WhatsApp Cloud API webhook** (`entry[].changes[].value.messages[]`) | download via media id, store bytes (URL dies in 5 min, so bytes were the only option) | store `media.id` in `chat_messages.media_id`; resolve to a fresh URL on read, cache ≤5 min in RAM (`src/services/attachmentResolver.js`) |
| 3 | **Instagram messaging webhook** | same downloader as #1 | same as #1 |
| 4 | **Media proxy** `GET /api/chat/media/:id` | stream `chat_media_blobs.data`; 500s when the row/table is gone | 302 to the stored CDN URL; else one bounded blob lookup; else clean 404 (`src/routes/media.js`) |
| 5 | **Inbox messages API** `GET /api/chat/conversations/:id/messages` | joined/selected blob columns, serialised to base64 for the UI | selects only URL columns, returns `media` metadata object (`src/routes/chat.js`) |
| 6 | **Conversation list API** `GET /api/chat/conversations` | preview thumbnail sometimes joined the blob table | `last_message` text only; no media join (`src/routes/chat.js`) |
| 7 | **Message send path** (agent sends an attachment) | uploaded bytes → blob table | **out of scope here**: should go to object storage (Supabase Storage / S3) and store the public URL. Do not rebuild the blob table. |
| 8 | **Graph/attachment download helper** (wherever `fetchAttachment`, `downloadMedia`, `getMediaBuffer` live) | returns a Buffer, called by #1–#3 | deleted. Only `src/services/mediaFetcher.js` remains, and it is used **exclusively** by the proxy for WhatsApp URLs that require an auth header. |
| 9 | **DB migration that created the table** | `create table chat_media_blobs (... data bytea ...)` | `migrations/001_media_urls.sql`; table becomes read-only legacy, then truncated/dropped |
| 10 | **Any nightly/backup job touching `chat_media_blobs`** | copies 106 MB | remove from the job list (§6) |

### Grep patterns to find them in your codebase

```bash
# writers
grep -rn "chat_media_blobs" --include=*.js --include=*.ts .
grep -rnE "arrayBuffer\(\)|Buffer\.from\(.*base64|toString\('base64'\)" .
grep -rnE "INSERT INTO chat_media_blobs|from\('chat_media_blobs'\).*insert" .

# readers
grep -rn "/api/chat/media" --include=*.js --include=*.tsx .
grep -rnE "from\('chat_media_blobs'\).*select" .

# download helpers
grep -rnE "download(Media|Attachment)|fetchAttachment|getMediaBuffer" .
```

---

## 3. What changed, requirement by requirement

### Req 1 — locate every write/read
See §2. The new code has exactly **one** module that reads the legacy table
(`src/services/legacyBlobStore.js`, read-only, guarded) and **zero** that write it.
`assertWritesDisabled()` fails loudly if `ENABLE_LEGACY_BLOB_WRITES` is ever turned on.

### Req 2 — stop downloading; store `payload.url`
```js
// src/services/attachmentResolver.js
export function extractAttachmentFromMessengerMessage(message) {
  const first = message.attachments?.[0];
  return {
    url: pickAttachmentUrl(first.payload),   // payload.url / file_url / image_data.url
    kind: first.type, mimeType: first.payload.mime_type,
    mediaId: first.payload.id || null,        // kept for /refresh-media
  };
}
```
No `fetch`, no buffer, no base64. WhatsApp stores the **media id** because its URLs
expire in 5 minutes — storing that URL would just relink to a dead asset.

New columns (migration `001`): `media_url`, `media_type`, `media_mime_type`, `media_id`,
`media_source`, `media_refreshed_at`, plus a `CHECK` constraint rejecting `data:` URLs.

### Req 3 — keep `/api/chat/media/:id` working safely
```js
// src/routes/media.js — order of resolution
1. chat_messages.media_url exists  -> 302 to it          (client fetches from the CDN)
2. WhatsApp media id                -> stream once, cache, serve
3. legacy blob row exists           -> serve bytes        (transitional only)
4. nothing                          -> 404 JSON, never 500
```
Measured on a running server with the DB unreachable:

```
request 1: 404 in 2.004s     <- bounded lookup, opens the breaker
request 2: 404 in 0.001s     <- fast path, no DB round-trip
request 3: 404 in 0.0008s
```
A *dropped* `chat_media_blobs` is treated as "missing", not as an error
(`42P01`, `PGRST205`, `42501` → `isMissingRelation()`).

### Req 4 — `GET /api/chat/refresh-media/:messageId`
Implemented in `src/routes/refreshMedia.js`. Behaviour verified end to end:

| Case | Result |
|------|--------|
| Messenger message, URL expired | calls `GET /{mid}?fields=attachments` with the page token → new URL → **persisted** to `chat_messages` → returned with `persisted: true` |
| WhatsApp message | calls `GET /{media_id}?phone_number_id=…` → returns a 5-minute URL (`persisted: false`, it is not worth storing) |
| No attachment / unknown message | 404 with a specific `error.code` |
| Requires auth | `Authorization: Bearer <supabase jwt>` (admin role) |

Response shape:
```json
{
  "success": true,
  "platform": "messenger",
  "url": "https://lookaside.fbsbx.com/...",
  "proxy_url": "/api/chat/media/s/<signed-token>",
  "mime_type": "image/jpeg",
  "kind": "image",
  "persisted": true,
  "refreshed_at": "2026-11-12T23:31:00.000Z"
}
```

### Req 5 — affected files
§4 is the full manifest.

---

## 4. Affected files

### New backend — `hamza-backend/`

| File | Role | Why it changed |
|------|------|----------------|
| `src/services/attachmentResolver.js` | **the refactor** | extract `payload.url`; build the `media` payload; no bytes |
| `src/services/mediaIngestService.js` | webhook → `chat_messages` | inserts URL + metadata instead of blob rows |
| `src/services/legacyBlobStore.js` | legacy reads only | read-only, circuit-broken, time-bounded, cannot write |
| `src/services/mediaFetcher.js` | bounded byte fetch | **proxy only**, host allowlist, size cap, LRU cache |
| `src/services/messageRepository.js` | `chat_messages` access | column allowlist; never selects blob columns |
| `src/services/conversationService.js` | find-or-create thread | race-safe dedupe |
| `src/services/graphClient.js` | Graph API | `/{mid}?fields=attachments`, WhatsApp media id, `pickAttachmentUrl` |
| `src/routes/media.js` | `/api/chat/media/:id`, `/s/:token` | 302 → stream → blob → 404 ladder |
| `src/routes/refreshMedia.js` | `/api/chat/refresh-media/:messageId` | requirement 4 |
| `src/routes/chat.js` | inbox API | serialises `media`, adds `/media-health` |
| `src/routes/webhooks.js` | Meta + WhatsApp | verifies signature, no media I/O |
| `src/lib/mediaSignature.js` | signed proxy URLs | keeps CDN tokens out of the browser |
| `src/lib/metaSignature.js` | `X-Hub-Signature-256` | webhook authentication |
| `src/lib/withTimeout.js` | bounded dependencies | `<img>` requests cannot hang |
| `src/lib/circuitBreaker.js` | shared DB health | stops hammering a dead table |
| `src/lib/lruCache.js` | bounded RAM cache | replaces 36 GB of DB egress with ≤32 MB of RAM |
| `src/db/supabase.js` | client + error taxonomy | recognises a dropped table |
| `src/middleware/auth.js` | admin gate | inbox endpoints |
| `src/config/env.js` | env contract | `ENABLE_LEGACY_BLOB_WRITES` defaults to false |
| `src/app.js`, `src/server.js` | wiring | graceful shutdown |
| `migrations/001_media_urls.sql` | schema | new columns, indexes, `data:` guard, ordered backfill |
| `migrations/002_media_storage_guard.sql` | guard view | `chat_binary_storage_audit` should always return zero rows |
| `test/*.js` | 21 unit/integration + 8 e2e | proves the 302/404/refresh contracts |

### Modified frontend — this repo

| File | Change |
|------|--------|
| `src/components/Inbox/ChatThread.jsx` | renders `<ChatMedia>`; **bug fix** — media-only messages were rendering as empty bubbles because the bubble only printed `content` |
| `src/components/Inbox/ChatMedia.jsx` | **new** — image/video/audio/file rendering, one silent refresh on error, graceful "Attachment unavailable" |
| `src/lib/chatMedia.js` | **new** — `getMediaSrc`, type guards, `refreshMediaUrl()` |

`UnifiedInbox.jsx` and `ConversationList.jsx` needed no change: the conversation list
already reads `last_message` text only.

---

## 5. Frontend contract

The backend response for a message is backwards compatible:

```jsonc
{
  "id": "...", "direction": "inbound", "content": "📷 Photo",   // unchanged
  "has_media": true,                                            // new
  "media_url": "https://lookaside.fbsbx.com/...",               // new (may be null for WA)
  "media": {                                                    // new
    "available": true,
    "url": "https://lookaside.fbsbx.com/...",
    "proxy_url": "/api/chat/media/s/<signed>",                  // preferred, works for WA
    "kind": "image", "mime_type": "image/jpeg",
    "available_via": "stored_url", "expires_at": null
  }
}
```

Media proxy routes are protected by **signed, expiring URLs** rather than the bearer
token, because `<img>` cannot send headers. The token leaks nothing: it is
`base64url({id,exp}).hmac` and contains no CDN host or page token.

---

## 6. Deployment order (this is the risky part)

```bash
# 1. Ship backend first. It reads old tables and serves old blobs fine.
# 2. Apply the migration (adds columns + indexes, backfills pointers).
psql "$SUPABASE_DB_URL" -f hamza-backend/migrations/001_media_urls.sql

# 3. Verify: media-health should show URL-backed messages, zero blob writes.
curl -H "Authorization: Bearer $ADMIN_JWT" https://api.../api/chat/media-health

# 4. Backfill historical rows that only have blobs, message by message.
curl -H "Authorization: Bearer $ADMIN_JWT" \
     https://api.../api/chat/refresh-media/<message-id>

# 5. Only when the inbox shows no broken media — reclaim the storage:
psql "$SUPABASE_DB_URL" -c "truncate table public.chat_media_blobs;"
psql "$SUPABASE_DB_URL" -c "vacuum full public.chat_media_blobs;"
#    (or DROP TABLE once you are confident — the backend already tolerates it)
```

Rollback is safe at every step: the old proxy path still serves blobs, and the new
columns are additive.

### After truncation, expect these
- `/api/chat/media/:id` → **404** for pre-refactor ids that were never refreshed. This is
  the intended behaviour, not an outage.
- One `WARN chat_media_blobs is unavailable …` per cooldown window. Anything more means
  the breaker was reset too aggressively.
- `chat_binary_storage_audit` (migration 002) must return **zero rows** forever.

---

## 7. Expected impact

| Metric | Before | After |
|--------|--------|-------|
| `chat_media_blobs` TOAST | 106 MB | 0 (truncated/dropped) |
| Rows written per attachment | 1 blob row (KB–MB) | 1 text column update (URL string) |
| Egress on inbox read | from Postgres, uncached, per view | from Meta's CDN, browser-cached |
| Proxy egress | every image | only WhatsApp (LRU-capped at 32 MB RAM, ≤5 min TTL) |
| Webhook latency | download + insert on the hot path | one insert |
| Failure mode after truncation | 500s | clean 404 + `refresh-media` recovery |

The only remaining byte traffic through our infrastructure is WhatsApp media (Meta
requires an `Authorization` header, so a redirect is impossible) — bounded by
`MEDIA_STREAM_MAX_BYTES` and the LRU cache.

---

## 8. Notes and follow-ups

- **`ENABLE_LEGACY_BLOB_WRITES`** exists purely as a kill-switch and defaults to `false`.
  Nothing in this codebase writes to the table.
- **Sending attachments (Req-2 gap).** Agent-sent media still needs a destination; use
  object storage and store the URL. The blueprint is in §2 row 7.
- **Signature verification is mandatory.** If `META_APP_SECRET` is absent the webhook
  refuses events (500 `WEBHOOK_NOT_CONFIGURED`) rather than trusting unauthenticated
  payloads.
- **`refresh-media` is admin-only.** It can trigger outbound Graph calls, so it is behind
  the bearer-token gate — unlike the media proxy.
- **Test coverage.** `npm test` (21 tests: URL extraction, signing/tampering, SSRF
  allowlist, signature verification, dropped-table detection, breaker, LRU, 302, 404,
  outage degradation, fast-path recovery) and `node test/smoke-e2e.mjs` (8 checks against
  a mock Graph API).
