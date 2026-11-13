# Database Audit — Supabase Disk Emergency

**Date:** 2026-11-12
**Trigger:** database at **492 MB / 500 MB (98 %)**, Log Ingestion at **90 %**
**Deliverable:** [`scripts/db-diagnostics.sql`](scripts/db-diagnostics.sql) — one paste-and-run script for the Supabase SQL Editor

> **Read this first.** At 98 % you are one large `INSERT` away from hard failures: Postgres starts by refusing writes, then the WAL checkpoint can't proceed and the instance becomes read-only or restarts. Treat this as production-incident triage, not routine hygiene. **Do §5 of this document (drop unused indexes) before anything else — it is instant, deletes no data, and is usually the fastest 10-50 MB you will ever find.** Do *not* run `VACUUM FULL` until you have read the warning in §6.1: it needs free space you currently do not have.

---

## 0. What could and could not be audited from this repository

This is the **frontend** repository (`hamza-fabrics-admin`). It contains:

| Looked for | Found |
|---|---|
| `*.sql` files | **none** |
| `supabase/` migrations directory | **none** |
| `prisma/schema.prisma`, `drizzle.config.*` | **none** |
| `node-cron`, `bullmq`, `pg_cron`, any scheduler | **none** (not a single scheduler/queue dependency in `package.json`) |
| Any direct database client | **none** — no `@supabase/supabase-js`, no `pg`, zero `select(` / `from(` calls |

Every database statement is executed by the separate Node backend behind `VITE_API_URL`. So this document is built from **two sources of evidence**, and I have labelled each finding with its confidence:

1. **Hard evidence from this repo** — the 147 HTTP calls the UI makes, the payload shapes it sends and parses, and the loops that drive them.
2. **The database itself** — `scripts/db-diagnostics.sql` interrogates `pg_catalog`, which is the only way to get ground truth about *your* schema. It has been executed end-to-end against a real PostgreSQL 16.2 instance with a seeded 64 MB schema (see §7).

Table names below are **inferred from API routes and field access** — they are almost certainly right, but the script proves them.

---

## 1. Large payloads stored in the database

### 1.1 Confirmed by frontend evidence

| # | Payload | Evidence (file:line) | Confidence | Why it grows |
|---|---|---|---|---|
| 1 | **`orders.products` — line items as JSON** | `ThermalSticker.jsx:35`, `CustomerAIProfile.jsx:64`, `Orders.jsx:372` all do `typeof order.products === 'string' ? JSON.parse(order.products)` — that guard only exists for a **text/json column**, not a joined table | **Certain** | Each order carries every line item, and **each line item embeds a full `image` URL**. My seeded test used a 400-char signed CDN URL per item; a Supabase Storage URL with a transform token is comparable. 3 items × 2 orders/day × 3 years ≈ 6.5 k line items. If any `image` field ever holds a base64 string instead of a URL, this column alone consumes the database. |
| 2 | **`orders.attachments` — JSON array** | `OrderTable.jsx:324` reads `order.attachments?.length`; `Orders.jsx:46` has an `attachments` column toggle | **Certain** | Fetched for every row but only `.length` is ever rendered. Customer-submitted photos (see #5) are the obvious thing to land here. |
| 3 | **`customers.metrics` — JSON written from the browser** | `Orders.jsx:370-371` `PUT /api/customers/:phone/metrics` with a `metrics` object containing a `breakdown` array per courier; read back at `Orders.jsx:525` | **High** | Overwritten per customer (not append), so it is bounded — but it is a per-customer JSON blob of ~250-500 B in a table you already page through. Low priority. |
| 4 | **`orders.billing` — JSON** | `OrderModal` builds `billing: { discount, advance, subTotal, deliveryCharge, total }`; `Orders.jsx:72` | **High** | Small per row (~100 B), but currently shipped on every order of every list page. A projection fixes it. |
| 5 | **Resolution-centre images** | `ResolutionCenter.jsx:37-41` converts every selected file with `readAsDataURL`, then `:64-70` uploads via `FormData` (correct) | **Medium** | The client is clean — base64 is preview-only. But the same lineage of code elsewhere may not be. **This is exactly what §6 of the script detects**; do not assume. |
| 6 | **`settings.system` — arrays of image URLs** | `Settings.jsx:29-31, 272-273` (`hero_images`, `hero_mobile_images`, `footer_images`), `Settings.jsx:245` mirrors the whole object into `localStorage` | **High** | Small (URLs), but it is read by 3 different components on every boot — that's a *log-ingestion* and egress problem, not a size problem. |
| 7 | **`settings.env` — environment/secret values in a table** | `Settings.jsx:125, 303` `GET /api/settings/env` | **Medium** | If this stores raw `.env` contents it is a secret-management problem first and a size problem second. |
| 8 | **Courier API credentials in plaintext** | `CourierManagement.jsx:157, 202` — `api_key`, `secret_key`, `webhook_secret` are round-tripped to the browser in `GET /api/courier/active` | **Certain** | Not a size issue — a **security** issue worth flagging while you are in here. Those secrets are also sent on every page load. |

### 1.2 Session dumps and auth growth (check, don't assume)

`auth.sessions` and `auth.refresh_tokens` grow with every login and are only cleaned by GoTrue's own sweeper. A client that logs in in a loop — or a mobile app with a refresh bug — adds rows faster than the sweeper removes them. §4 of the script counts all five `auth` tables.

### 1.3 The measurement trap the script avoids

I verified both behaviours on PostgreSQL 16.2 rather than trusting documentation:

| Value | `octet_length(col::text)` (logical) | `pg_column_size(col)` (physical) |
|---|---|---|
| 3 MB of repeated text | 3,000,000 | **34,350** (compressed 87×) |
| 24 MB of random hex | 24,000,000 | 24,000,000 |
| 3.2 MB incompressible, TOASTed | 3,200,000 | 3,200,000 |

Consequence: **base64 of a JPEG/PNG does not compress** (already-compressed input), so for real images physical ≈ logical and every byte is paid twice — once on disk, once on every read. Base64 of *text* can compress enormously and hide the problem from a naive size query. The script reports **both** numbers side by side (§5) so neither failure mode is invisible.

---

## 2. Cron jobs, webhooks and background tasks writing rows without cleanup

There is **no scheduler in this repository** — no `node-cron`, no `pg_cron` usage, no queue. Everything below is a write path the UI can trigger, plus what it implies about the backend's own jobs. Check `cron.job` with §16 of the script for scheduled jobs that live only in the backend.

### 2.1 Ranked by risk of unbounded growth

| # | Writer | Where the UI triggers it | Frequency | Retention today | Verdict |
|---|---|---|---|---|---|
| 1 | **`POST /api/webhooks/:courier/dm/:uuid`** | URL is generated per courier at `CourierManagement.jsx:625`; 4 couriers (Pathao, Steadfast, Paperfly, RedX) | **Every shipment status change, for every order, from 4 couriers.** Courier webhooks retry on non-2xx — so a failing handler multiplies the insert rate | none evident | **Highest risk.** If the handler logs the raw callback body (very common), this table is the bill. Requires 30-90 day retention. |
| 2 | **`POST /api/device/register`** | `DeviceContext.jsx:20-27`, mounted app-wide at `App.jsx:224` | **On every page load / hard refresh / new tab, for every user**, with a stable client-generated UUID | none evident | If this `INSERT`s instead of `UPSERT ON CONFLICT (device_uuid)`, it is an unbounded row generator driven by normal browsing. 10 staff × 30 loads/day = ~110 k rows/year. **Check for an upsert before anything else.** |
| 3 | **`POST /api/brain/analyze`** + fraud-alert writes | `BrainDashboard.jsx:121, 130-139, 149` | Every "Run Full Analysis" click and every alert resolve | none evident | Writes insights + alerts + `activity_log`. The reader asks for `?limit=20` (`BrainDashboard.jsx:48`) — decisive proof the table is unbounded and only the newest 20 matter. |
| 4 | **`POST /api/cart-recovery/detect`** | `CartRecoveryDashboard.jsx:56`, manual button | Every click | none evident | Each run inserts a snapshot per abandoned cart. No dedupe is visible from the UI, so repeated runs almost certainly duplicate the same carts. |
| 5 | **`POST /api/courier/sync`** and **`POST /api/financial-audit/sync-ad-spend`** | `Orders.jsx:244`, `CommandCenter.jsx:102`, `FinancialAudit.jsx:50` | Manual, but likely also scheduled in the backend | none evident | Sync-history rows. Harmless individually; these are the classic "insert a row per sync attempt including failures" tables. |
| 6 | **`notifications`** | Written by the backend on every order/ship/return/fraud/low-stock event | Continuous | none evident | The dropdown renders at most **30** (`AdminHeader.jsx:87` slices to 30). Everything older is dead weight. Note it was also being fetched unbounded on every page load until the previous fix. |
| 7 | **`chat_messages`** | WhatsApp inbound via `POST /api/chat/...`; read with `?limit=100` (`ChatThread.jsx:41`) | Continuous | none evident | Append-only. Archive beyond 12 months; 100 messages is all any screen shows. |
| 8 | **`auto_call.logs`** | `AutoCallCenterReport.jsx:26-28`; read with `?limit=100` | Per call attempt | none evident | Same pattern. |
| 9 | **`auth.sessions` / `auth.refresh_tokens`** | Every login, incl. `Login.jsx` and `Verify2FA.jsx` | Per login + per refresh | GoTrue's sweeper | Verify with §4; a refresh loop here also inflates **Log Ingestion**. |
| 10 | **`storage.objects`** | `POST /api/upload-image` (`Settings.jsx:141`, `ProfileSettings.jsx:48`) | Per upload | n/a | Storage rows are small; the *bytes* live in the storage service. §18 tells you whether originals are oversized. |

### 2.2 The loop that links DB size, egress and log ingestion

Worth calling out because it was fixed in the previous change and explains two of your three alarms at once: `AdminHeader` polled `/api/notifications/unread-count` **every 60 seconds, on every page, forever**. Each poll = one HTTP request → one row read (egress), one backend access log line (**Log Ingestion**), and one Postgres statement (if `log_statement`/`log_min_duration_statement` is chatty, another **Log Ingestion** event). `DeviceContext` does the same on every page load. Reducing polling frequency attacks all three quotas simultaneously.

---

## 3. The diagnostic script

**File:** [`scripts/db-diagnostics.sql`](scripts/db-diagnostics.sql)
**Run:** Supabase Dashboard → SQL Editor → paste one section at a time → read the Messages pane for `NOTICE` output.
**Safety:** read-only. The only writes are to `TEMPORARY` tables and one optional `create extension if not exists pgstattuple` (wrapped in an exception handler so it degrades gracefully).

| § | Section | Answers |
|---|---|---|
| 1 | Overview | db size, **% of the 500 MB plan**, headroom, when the stats were last reset |
| 2 | **Top 10 tables** | heap / index / **TOAST** / total, with % of database |
| 3 | Largest individual objects | catches one runaway index or one TOAST table |
| 4 | `auth` / `storage` / `realtime` / `cron` schema sizes + auth row counts | session dumps, storage metadata |
| 5 | **Which columns hold the bytes** | physical **and** logical bytes per text/json/bytea column |
| 6 | **Base64 / data-URI detection** | the smoking gun, if it exists |
| 7 | Largest individual rows | points at the specific offenders |
| 8 | Real free space (`pgstattuple`) | dead + free bytes per table, with autovacuum tuning hints |
| 9 | **Unused indexes** | with ready-to-run `drop index concurrently` statements |
| 10 | **Duplicate indexes** | identical column sets |
| 11 | **Redundant prefix indexes** | `(a)` fully covered by `(a, b)` |
| 12 | **Write rate** | `n_tup_ins` / `n_tup_upd` / `n_tup_del` per table — *what is still inserting rows today* |
| 13 | Retention profile | which tables have a timestamp to age off |
| 14 | Replication slots, large objects, extensions | hidden consumers (an inactive slot silently retains WAL) |
| 15 | **Dead tuples + generated vacuum commands** | split into safe-to-`VACUUM FULL` vs needs-`pg_repack` |
| 16 | `pg_cron` jobs (if installed) | scheduled jobs and their recent runs |
| 17 | `pg_stat_statements` top statements | which query returns the most rows |
| 18 | Storage buckets | object counts and average/largest file size |

---

## 4. Which sections to run first, and what to do with the answers

Run **§2 → §5 → §6 → §12 → §9** in that order. That is 5 queries and it will tell you the whole story.

| If § says… | Then the problem is… | Fix |
|---|---|---|
| §2 shows one table > 40 % of the DB | a log/webhook table (§2 of this doc) | retention, §6.3 |
| §5 shows one column > 100 MB | a JSON/base64 column | stop storing it — move to Storage, keep a URL |
| §6 returns **any** rows | base64 in the database | highest-value fix in this document: convert to Storage URLs |
| §12 shows a table with high `n_tup_ins` and ~0 `n_tup_del` | unbounded writer | add a retention job |
| §9 shows unused indexes > 30 MB total | dead indexes | drop them — **instant, safe** |
| §15 shows > 20 % dead tuples | bloat, not data | `VACUUM (ANALYZE)` first, see §6.1 |
| §14 shows an inactive replication slot | WAL retention | drop the slot |

---

## 5. Do this first: reclaim space without deleting anything

Unused and duplicate indexes are pure overhead. They cost disk, they cost write throughput, and after the first year nobody remembers what they were for.

```sql
-- Generate the list (script §9):
--   → drop index concurrently if exists public.orders_status_idx;
```

Rules before you run any of them:

1. **Never drop a primary key, a unique index, or an index backing a constraint** — the script already excludes all three.
2. `DROP INDEX CONCURRENTLY` does not block reads or writes. Run it outside a transaction block (each statement on its own).
3. An index with `idx_scan = 0` may still be load-bearing if Postgres restarted recently — check `stats_last_reset` in §1 and wait 24 h if it is recent.
4. **Foreign keys**: dropping the index on the *referencing* column of a large FK makes deletes/updates on the parent do a sequential scan. Not a correctness problem, a latency one.

Expected reclaim on a 3-year-old admin like this: typically **5-15 % of total database size**. On 492 MB that is 25-75 MB — most of your immediate headroom, for zero risk.

---

## 6. Retention and cleanup

### 6.1 The 492/500 MB trap

**`VACUUM FULL` will not save you right now.** It rewrites the table into a new file and therefore needs free disk equal to the table's *new* size. You have ~8 MB free. The realistic sequence is:

```
a) drop unused indexes               → immediate, safe
b) DELETE old rows in batches        → space becomes reusable INSIDE the table
c) VACUUM (ANALYZE) table            → makes that space available to the table again
d) pg_repack (or VACUUM FULL later)  → returns space to the OS, only once you have headroom
```

`VACUUM` (without `FULL`) never returns space to the operating system — it only marks pages reusable by that table. If your goal is "the 492 MB number must go down", you *must* eventually rewrite the tables (step d), and to do that you must first free ~1× the table size. Deleting first is what makes that possible.

Practical order if you cannot afford any of that: **upgrade the plan** to get headroom, then clean up calmly. Running at 98 % is how projects lose data to a failed migration.

### 6.2 Retention policy I would set

| Table | Keep | Rationale from the code |
|---|---|---|
| courier webhook / callback log | **90 days** | Only used to debug a specific shipment; nothing in the UI reads it |
| `device_register` | **upsert, do not insert** | Same UUID re-registers on every page load |
| `notifications` | **90 days** | Dropdown shows 30 (`AdminHeader.jsx:87`) |
| `chat_messages` | **12 months hot**, archive older | Thread renders 100 (`ChatThread.jsx:41`) |
| `auto_call.logs` | **90 days** | List renders 100 |
| `brain_activity_log` | **30 days** | Renders 20 (`BrainDashboard.jsx:48`) |
| `cart_recovery` | **60 days**, unique on `(cart_id, run_date)` | Prevents duplicate rows per detect run |
| `orders` / `order_items` | **forever** | Financial record |
| `auth.sessions` / `auth.refresh_tokens` | let GoTrue sweep; verify counts | — |

### 6.3 Batched delete pattern (safe on a live database)

Never `DELETE FROM big_table WHERE created_at < now() - interval '1 year'` in one statement — it takes a long lock, bloats the table further with dead tuples, and can trigger a WAL storm.

```sql
-- Repeat until 0 rows affected. Each batch is a separate transaction.
delete from public.notifications
where id in (
  select id from public.notifications
  where created_at < now() - interval '90 days'
  limit 5000
);
```

Then schedule it. If `pg_cron` is available (check §14c):

```sql
select cron.schedule('purge-notifications', '15 3 * * *', $$
  delete from public.notifications
  where id in (select id from public.notifications
               where created_at < now() - interval '90 days' limit 5000);
$$);
```

Do **not** schedule `VACUUM FULL`. Do schedule a plain `VACUUM (ANALYZE)` on your hottest tables if autovacuum is not keeping up — §8 of the script prints the per-table autovacuum tuning hints.

### 6.4 Stop new bloat at the source

```sql
-- If device registration is not idempotent, make it so:
create unique index if not exists devices_uuid_key on public.devices (device_uuid);
-- and make the handler: insert ... on conflict (device_uuid) do update set last_seen = now();

-- Prevent duplicate cart-recovery snapshots:
create unique index if not exists cart_recovery_dedupe on public.cart_recovery (cart_id, run_date);

-- Cap the JSON blob on orders (Postgres has no row limit, but you can enforce one):
alter table public.orders add constraint orders_products_not_too_big
  check (octet_length(products::text) < 200000) not valid;
alter table public.orders validate constraint orders_products_not_too_big;  -- run off-peak
```

That last constraint is the single most effective guard against someone shipping "just put the image in the JSON" — it fails loudly instead of silently eating the disk.

---

## 7. How the script was validated

Rather than ship untested SQL, I ran it against a real instance:

- **PostgreSQL 16.2** (`pgserver`), seeded with a 64 MB schema modelled on the tables this codebase implies: `orders` (4 000 rows, `products` and `attachments` JSONB), `customers` (3 000 rows with `metrics` JSONB), `chat_messages` (20 000), `notifications` (8 000), `brain_activity_log` (30 000, then 90 % of rows deleted to create dead tuples), plus stubbed `auth.*` and `storage.objects` tables, and a deliberately messy index set (one unused, one duplicate, one redundant prefix).
- **Result: 26/26 statements execute successfully.** The script correctly reported:
  - top tables with a real heap/index/TOAST split and % of DB,
  - an **81-hit, 4.8 MB base64 payload** in `orders.attachments` (§6),
  - `orders_status_idx` vs `orders_status_dup_idx` as duplicates (§10) and `orders_status_idx` as a redundant prefix of `orders_status_created_idx` (§11),
  - 33 % dead tuples with a generated `vacuum (full, analyze, verbose) chat_messages;` (§15),
  - the seeded `auth` schema at 560 kB and storage buckets at 57 MB (§4, §18),
  - graceful degradation when `pgstattuple` is unavailable ("skipping precise bloat scan") rather than an error.

Two bugs were found and fixed during validation: a headroom expression that subtracted the database size from itself (§1), and a comment claiming `pg_column_size` returns an 18-byte pointer for TOASTed values — it does not, it detoasts; the script now reports physical *and* logical bytes and documents the real numbers measured above.

---

## 8. Log Ingestion at 90 % — this is a *different* quota

Log Ingestion is metered by Supabase's log pipeline (Logflare), **not** by database size. Freeing 200 MB of disk will not move it. It is counted in **events**, and the biggest producers in a project like this are:

1. **Chatty polling.** Fixed already: notifications went from every 60 s to every 5 min, and stop entirely while the WebSocket is up. `DeviceContext` still fires on every page load — see §2.1 #2.
2. **Postgres log verbosity.** In the dashboard, under Database → Settings:
   - `log_statement = none` (if it is `all`, every query is an event — with 20+ queries per page load, this alone can be your quota),
   - `log_min_duration_statement = 1000` (log only slow queries, not every statement),
   - `log_min_duration_sample = -1`, `log_temp_files = -1`,
   - avoid `log_connections` / `log_disconnections` in production.
3. **Repeated error loops.** A frontend that polls an endpoint returning 401/500 generates a log line per attempt, per user, per minute. This is worth grepping for in the API logs — the same requests that were driving egress.
4. **Verbose Realtime / PostgREST logs.** If `log_level` is `info` and Realtime is on the publication for large tables, every change is logged.

Because the log quota is per-plan and counts events, the cheapest wins are (2) then (3). Neither requires a deploy.

---

## 9. Summary — the plan

| Priority | Action | Expected effect | Risk | Effort |
|---|---|---|---|---|
| **P0** | Run `scripts/db-diagnostics.sql` §2, §5, §6, §12 | Tells you where the 492 MB actually is | none (read-only) | 10 min |
| **P0** | Drop unused / duplicate / redundant-prefix indexes (§9-§11) | **25-75 MB** typical, immediate | very low | 20 min |
| **P0** | Make `/api/device/register` an upsert (needs backend) | stops a per-page-load row generator | low | 30 min |
| **P1** | Retention on webhook log, notifications, activity log, auto-call logs | the long-term trend reverses | low (batched deletes) | 2 h |
| **P1** | `VACUUM (ANALYZE)` the hottest tables | makes deleted space reusable | none (no lock) | 10 min |
| **P1** | Move any base64/blob column to Storage; store a URL | potentially the largest single reclaim | medium | 1-2 days |
| **P2** | `pg_repack` the big tables once headroom exists | returns space to the OS | low (online) | 1 h |
| **P2** | Add the `octet_length` CHECK constraints (§6.4) | prevents recurrence | none | 30 min |
| **P2** | Reduce Postgres log verbosity | **directly addresses Log Ingestion 90 %** | none | 10 min |
| **P3** | Upgrade the plan for headroom | removes the 98 % risk while you work | none | — |

**One honest caveat:** every number in this document that is not derived from your database is an estimate built from code evidence. Run §2 and §5 before acting on any of it — and re-run §2 afterwards to confirm the space actually came back.
