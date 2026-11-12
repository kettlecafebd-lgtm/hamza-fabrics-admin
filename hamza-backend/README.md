# hamza-backend

Chat backend for the Hamza Fabrics admin inbox. Chat attachments are stored as
**CDN URLs, never as bytes**. See [`docs/AUDIT.md`](docs/AUDIT.md) for the full
audit that motivated this design (106 MB TOAST, 36 GB+ egress).

## Why this exists

The previous design downloaded every inbound Messenger/WhatsApp/Instagram
attachment, base64-encoded it, and wrote it into `chat_media_blobs` in
Postgres. That table is the source of both the TOAST footprint and the egress
spike. This service removes the middle step entirely.

```
webhook  ->  chat_messages.media_url (a URL string)  ->  browser loads from Meta's CDN
```

## Quick start

```bash
cp .env.example .env      # fill in Supabase + Meta credentials
npm install
npm test                  # 21 unit/integration tests
node test/smoke-e2e.mjs   # 8 end-to-end checks against a mock Graph API
npm start                 # listens on :5000
```

Boot fails loudly if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing —
a half-configured media pipeline is worse than a stopped one.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | none | liveness + storage mode |
| GET | `/api/webhooks/meta` | none | Meta verification handshake |
| POST | `/api/webhooks/meta` | `X-Hub-Signature-256` | Messenger/Instagram events |
| GET | `/api/webhooks/whatsapp` | none | WhatsApp handshake |
| POST | `/api/webhooks/whatsapp` | `X-Hub-Signature-256` | WhatsApp events |
| GET | `/api/chat/media/:id` | none (legacy) | 302 to stored URL, else blob, else 404 |
| GET | `/api/chat/media/s/:token` | signed HMAC | same, for URLs handed to `<img>` |
| GET | `/api/chat/refresh-media/:messageId` | Bearer (admin) | re-resolve an expired URL via Graph |
| GET | `/api/chat/conversations` | Bearer (admin) | inbox list |
| GET | `/api/chat/conversations/:id/messages` | Bearer (admin) | thread with `media` metadata |
| POST | `/api/chat/conversations/:id/messages` | Bearer (admin) | send text |
| GET | `/api/chat/media-health` | Bearer (admin) | proves no bytes are being stored |

## Design notes

- **`chat_media_blobs` is read-only here.** `src/services/legacyBlobStore.js` serves
  old rows during the transition and nothing writes to the table.
- **Missing table is not an error.** `42P01` / `PGRST205` / `42501` are classified as
  "missing" and become a clean 404. A circuit breaker prevents repeated round-trips,
  and a 2-second bound prevents a stalled DB from holding `<img>` requests open.
  Measured: first miss 2.0 s, subsequent misses ~1 ms.
- **WhatsApp is the only case that still streams bytes**, because its media URLs
  require an `Authorization` header and expire in 5 minutes. Those responses are
  cached in a bounded in-memory LRU (32 MB default) — never in Postgres.
- **Signed proxy URLs.** `/api/chat/media/s/:token` is `base64url({id,exp})` plus an
  HMAC. The browser never sees a Facebook CDN token or an upstream host.
- **SSRF guard.** Only `*.fbcdn.net`, `*.fbsbx.com`, `*.cdninstagram.com`,
  `*.facebook.com`, `*.whatsapp.net` over HTTPS are fetchable; private ranges are
  rejected.

## Migrations

```bash
psql "$SUPABASE_DB_URL" -f migrations/001_media_urls.sql   # additive, safe
# verify the inbox, then reclaim:
psql "$SUPABASE_DB_URL" -c "truncate table public.chat_media_blobs;"
psql "$SUPABASE_DB_URL" -c "vacuum full public.chat_media_blobs;"
```

`migrations/002_media_storage_guard.sql` adds a view that should always return
zero rows — if it ever doesn't, binary media is creeping back into Postgres.
