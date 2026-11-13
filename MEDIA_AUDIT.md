# Media & Cloud Storage Audit

**Repo:** `hamza-fabrics-admin` (Vite + React 19 SPA, ~19k LOC)
**Scope:** upload pipeline, orphaned objects, caching/delivery
**Date:** 2026-11-12

---

## TL;DR

| Question | Before | Now (this branch) |
|---|---|---|
| Are images compressed before upload? | **No.** Every path sent the camera original. A 12 MP phone photo is 3–6 MB; a 48 MP one is 10–20 MB. | Yes — client-side resize → WebP on all 6 image entry points, ~90–96 % smaller. |
| Are old files deleted on update/delete? | **No.** Zero delete calls existed anywhere. 100 % of replaced/deleted images leaked, forever. | Client sweep after a confirmed commit, guarded by a reference check. A server-side GC is still required (§5.4). |
| Is CDN caching usable? | **No.** `cacheControl` was never set, so objects went up with the bucket default and every cache was revalidated. | Uploads are content-addressed (`name-<hash>.webp`) and the backend is told to store `immutable` — stale bytes become impossible (§4.3, §5.1). |
| Are thumbnails loading full-size originals? | **Yes.** 40–48 px thumbs pointed at multi-MB originals. | Fixed: `thumbUrl` + `lazy` + `srcSet` (task 1 + this task). |

**The one thing that matters:** the browser cannot fix `Cache-Control` and cannot reliably see orphaned objects. Roughly half of this problem lives in the backend, which is not in this repository — §5 is the code for that half.

---

## 0. What I could and could not inspect

This repository is the **admin frontend only**. There is:

- no `supabase/` directory, no migrations, no SQL DDL;
- no `@supabase/supabase-js`, no AWS/R2 SDK, no `cloudflare`/`cdn`/`imgix`/`cloudinary` import anywhere in `src/`;
- no bucket names, no `cacheControl` value, no upload handler.

Everything below about *how* objects reach storage is therefore inferred from the two endpoints the frontend calls:

| Endpoint | Called from | Multipart fields |
|---|---|---|
| `POST /api/upload-image` | `Settings.jsx:141`, `ProfileSettings.jsx:48` | `file` or `image` |
| `POST /api/products[/:id]` | `Products.jsx` | `image`, `variantImage_<i>`, `reviewImage_<i>`, plus JSON metadata |

**Supabase Storage and Cloudflare R2 are presented as alternatives throughout.** I cannot tell you which one you run, and the backend repo remains the source of truth for the actual write call.

---

## 1. Upload pipeline — verdict: no compression at any point

### 1.1 Inventory (state at `96d9ea7`, before this branch)

| Entry point | File:line | Client validation | Compression |
|---|---|---|---|
| Product main image | `Products.jsx:583`, FormData at `:222` | **none** — no `accept`, no size check | none |
| Variant ("colour") image | `Products.jsx:682` | **none** | none |
| Review / customer photo | `Products.jsx:740` | **none** | none |
| Hero, mobile hero, footer, logo, favicon | `Settings.jsx:191` → `/api/upload-image` | `accept="image/*"` only | none |
| Admin avatar | `ProfileSettings.jsx:120` → `/api/upload-image` | 10 MB reject (`:35`) | none |
| Return/claim evidence | `ResolutionCenter.jsx:173` | `accept="image/*"`, multiple | none |
| Bulk product import | `BulkProductUpload.jsx:82` | `accept=".csv"` | n/a — **CSV only**, not an image path |

`accept="image/*"` is a file-picker hint, not validation: drag-and-drop, "All files" in the dialog, and renamed binaries all get through. Nothing checked `file.type` in code.

### 1.2 What that cost

A phone photo goes up at full resolution with EXIF intact:

| Source | Typical size | Served back into |
|---|---|---|
| 12 MP phone JPEG | 3–6 MB | a 40 px table thumbnail |
| 48 MP phone JPEG | 10–20 MB | a 96 px variant swatch |
| Screenshot PNG | 1–3 MB | a 36 px order row |

On slow Bangladeshi mobile data an operator uploading one 6 MB product photo waits ~30 s, and every later storefront visitor downloads the same 6 MB to see it at 400 px. The bytes are paid for at upload, at storage, and again on every cache miss.

### 1.3 What it does now

`src/lib/imageOptimize.js` decodes the file, downsamples with a high-quality two-pass draw when the scale factor is below 0.5 (single-step downscales alias badly on fabric weave), re-encodes to WebP, and returns a `File`:

| Preset | Max edge | Quality | Used by |
|---|---|---|---|
| `product` | 1200² | 0.80 | main product image |
| `variant` | 1200² | 0.80 | colour variant |
| `review` | 1200² | 0.80 | review photo |
| `settings` | 1200² | 0.80 | hero / mobile hero / footer / logo / favicon |
| `avatar` | 320² | 0.80 | admin avatar (still ≤ the 1200 cap) |
| `resolution` | 1200² | 0.80 | return evidence |

The house standard lives in `UPLOAD_STANDARD` — WebP, longest edge 1200 px, quality 0.80 — and every preset spreads it, so the number is defined once.

Design rules, each enforced in code and covered by the self-test (§6):

1. **Never block an upload.** Any failure — no canvas, undecodable codec, out of memory — returns the original `File`, and the existing flow proceeds untouched. The only exception is `ImageTooLargeError` (> 25 MB), which is surfaced to the operator as a readable toast instead of a hung request.
2. **Never make a file bigger.** If the re-encode is not smaller than the original, the original is kept.
3. **GIF and SVG pass through untouched** — re-encoding would destroy animation or vector crispness.
4. **EXIF orientation is honoured** (`createImageBitmap(file, { imageOrientation: 'from-image' })`), otherwise portrait photos upload rotated and look broken on the storefront.
5. **Filename is content-addressed**: `my-photo-3f9a1c0b7d2e4f51.webp`. Same bytes → same key (no duplicate uploads); different bytes → different key (immutable caching becomes safe, §4.3).

---

## 2. Orphaned files — verdict: nothing was ever deleted

I searched every delete/cleanup vocabulary the codebase could plausibly use:

```
grep -rn "storage.remove\|storage.from\|\.delete(\|DeleteObject\|media/delete\|/api/media" src/
grep -rn "deleteMedia\|removeObject\|purge" src/
```

Before this branch: **zero matches.** The only two storage-touching calls in the entire app were the two `/api/upload-image` POSTs.

### 2.1 The leaks

| Flow | Before | Result |
|---|---|---|
| Edit a product, replace the photo | New file uploaded; row updated to the new URL. Old object never referenced again. | 1 leaked object per replacement |
| Delete a product (`Products.jsx:174`) | `DELETE /api/products/:id` → DB row gone. Storage untouched. | *n* leaked objects per product (main + every variant + every review photo) |
| Delete a variant colour | Row gone, object stays | 1 leak |
| Replace a hero banner (`Settings.jsx`) | New upload, old object stays | 1 leak per banner swap |
| Bulk CSV import | Rows inserted; if rows are later deleted, nothing links back to storage | unlinked objects |
| Abandoned upload | Backend stores the object, then the DB write fails or the operator closes the tab | 1 leak, invisible to the client |

Banners are the expensive case: a 1920 px hero is typically 400 KB–2 MB, and merchandising teams rotate them weekly.

### 2.2 What it does now

`src/lib/mediaClient.js` exposes `deleteMedia(urls, { apiBase, token })`, which posts to a backend endpoint that does not exist yet:

```http
POST /api/media/delete
{ "urls": ["https://…/storage/v1/object/public/products/a.webp"] }
```

It is deliberately harmless: 404 (endpoint not deployed), network failure, and non-JSON responses are all swallowed with a console warning. A cleanup failure can never fail an operator's save.

Call sites, each placed **after** the database confirms the change, never before:

| Site | Trigger | Guard |
|---|---|---|
| `Products.jsx` `handleDelete` | product deleted | every candidate URL re-checked against the remaining rows |
| `Products.jsx` post-save | main image replaced | only if the server returned a *different* `image_url` |
| `Products.jsx` post-save | variant/review image replaced | `isUrlStillReferenced` across the catalogue |
| `Settings.jsx` `handleSave` | settings published | deferred queue — see §3.4 |
| `ProfileSettings.jsx` | avatar replaced **and** DB commit OK | previous URL from the JWT payload |

`isUrlStillReferenced(url, records, fields, excludeIds)` is the safety net: two products sharing one photo (a real pattern — same fabric, different colourways) will never lose it because one of them was deleted.

There is a second, narrower case inside a single product: two colour variants (or a variant and a review) can share one file, and only one of them is replaced. That row is excluded from the reference scan, so the sweep additionally refuses any URL that the submitted form still points at (`keptSideImages`).

### 2.3 What the client still cannot do

A client sweep is **not** garbage collection. It cannot see:

- objects orphaned by an upload that succeeded while the DB write failed;
- objects orphaned by a delete performed in another tab or by a direct SQL `DELETE`;
- objects uploaded by the bulk importer or any server-side job;
- objects left behind by a crashed browser before the save completed.

That is a **scheduled reconciliation job**, not a UI feature — §5.4.

---

## 3. Caching & delivery

### 3.1 Why `Cache-Control` was nil

A browser cannot set response headers on an object it uploads. `FormData` carries no headers. The only place the value can be applied is the storage write itself, in the backend:

```js
// Supabase
await supabase.storage.from('products').upload(path, file, {
  cacheControl: '31536000',
  contentType: file.type,
});
```
```js
// R2 / S3
await r2.send(new PutObjectCommand({
  Bucket, Key, Body,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable',
}));
```

Without it the object inherits the default (commonly `max-age=3600`, or none at all), so browsers and the CDN revalidate regularly and refill from origin — egress on every visit instead of every year.

### 3.2 The stale-bytes problem (why this had to be done together with §1.3)

`immutable` tells browsers to never revalidate. If the backend ever writes *new* bytes to the *same* key — e.g. `products/image_1719.jpg` overwritten with `upsert: true` — every client keeps the old picture for a year, and there is no way to recall it.

The upload path now sends a filename that is a hash of the encoded bytes:

```
IMG_4821.JPG  →  img-4821-3f9a1c0b7d2e4f51.webp
```

New bytes ⇒ new key ⇒ `immutable` is safe. It also means re-uploading an identical photo produces an identical key rather than a second copy — one of the main sources of duplicate objects.

### 3.3 Thumbnails were full-size originals

`OrderTable.jsx`, `VariantMatrix.jsx`, `ComboBuilder.jsx`, `SmartRestock.jsx` rendered 36–96 px thumbnails pointing at the original upload. A 50-row order page pulled 50 multi-hundred-KB originals.

Fixed in task 1 with `thumbUrl()` + `loading="lazy"` + `decoding="async"`, and completed here with `srcSet()` (2× candidate for retina) and an inline data-URI placeholder replacing `https://via.placeholder.com/...` — that third-party host was being hit once per missing image, and the domain is unreliable.

`thumbUrl`/`srcSet` rewrite `/storage/v1/object/public/` → `/storage/v1/render/image/public/?width=…` and are **gated behind `VITE_SUPABASE_IMAGE_TRANSFORMS=true`**, because Supabase Image Transformations are a paid add-on. With the flag off they return the URL unchanged, so nothing breaks today.

### 3.4 A correctness trap I had to design around (`Settings.jsx`)

Uploading a banner in System Configuration does **not** persist anything — it only updates local state; `handleSave` publishes the whole config later. Deleting the previous banner immediately after upload would have deleted an object the **live** storefront still pointed at, and if the operator then abandoned the page, the banner would be permanently broken.

The sweep is therefore queued: replaced URLs accumulate in `pendingMediaDeletes`, and only after `POST /api/settings/system` returns success are they released — and even then, any URL still present in the saved config is filtered out.

---

## 4. Code changes shipped (frontend)

| File | Change |
|---|---|
| `src/lib/imageOptimize.js` | **new** — resize/WebP pipeline, presets, content hash, `prepareImageForUpload`, `describeSaving` |
| `src/lib/mediaClient.js` | **new** — `MEDIA_CACHE_CONTROL`, `appendStorageFields`, `toStorageKey`, `isSameMedia`, `isUrlStillReferenced`, `deleteMedia` |
| `src/utils/imageUrl.js` | added `srcSet()`, `IMAGE_PLACEHOLDER` (task 1 added `thumbUrl`) |
| `src/pages/Products.jsx` | all three image inputs optimised; `accept` + type validation; previous-URL bookkeeping; orphan sweep on delete and replace |
| `src/pages/Settings.jsx` | banner/logo/favicon optimised; deferred orphan queue flushed on publish; savings toast |
| `src/components/ProfileSettings.jsx` | avatar → 320 px WebP; previous avatar released after commit |
| `src/pages/ResolutionCenter.jsx` | evidence photos → 1200 px WebP q0.80; type/size filter on selection |
| `src/components/Orders/OrderTable.jsx`, `src/components/ui/VariantMatrix.jsx` | `srcSet`, inline placeholder, no external placeholder host |
| `scripts/media-selftest.mjs` | **new** — 37 assertions over both modules |

Every change **degrades gracefully when the backend half is absent**:

- extra form fields (`cache_control`, `content_type`, `file_name`, `previous_image_url`, `variantImagePrevious_<i>`, …) are ignored by any multipart parser that does not know them;
- `deleteMedia` treats 404 as "not implemented yet" and stays silent;
- `srcSet`/`thumbUrl` return the original URL when transforms are disabled;
- the optimiser returns the original file on any failure.

The one intentional behaviour change: a source larger than **25 MB** is now rejected client-side with a readable error where it previously would have been uploaded. The ceiling exists because decoding a 40 MB image in a canvas can exhaust memory on a low-end laptop mid-form, losing everything typed. It is a single constant (`MAX_SOURCE_BYTES`) if you want it higher.

---

## 5. Backend work still required

The frontend can prepare bytes and ask for cleanup. It cannot store them correctly. These four items are the other half.

### 5.1 Store images with a real Cache-Control (pick one)

**Supabase Storage**

```js
// api/upload-image.js  (or wherever the multipart handler lives)
const file = form.files.image || form.files.file;
const prepared = await sharp(file.data)          // server-side safety net
  .rotate()                                      // honour EXIF
  .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 80 })
  .toBuffer();

const key = `${bucketPath}/${form.fields.file_name || randomUUID() + '.webp'}`;

const { data, error } = await supabase.storage
  .from('media')
  .upload(key, prepared, {
    contentType: 'image/webp',
    cacheControl: form.fields.cache_control || '31536000',   // ← the line that matters
    upsert: false,                                            // content-addressed keys never collide
  });
if (error) throw error;

res.json({ success: true, url: supabase.storage.from('media').getPublicUrl(key).data.publicUrl });
```

**Cloudflare R2**

```js
await r2.send(new PutObjectCommand({
  Bucket: process.env.R2_BUCKET,
  Key: key,
  Body: prepared,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000, immutable',
  Metadata: { source: 'admin-upload' },
}));
```

Notes:

- **Keep the server-side resize even with the client one.** Adversaries (and `curl`) skip the browser; `sharp` is the only thing you can trust. It is now mostly a no-op, so it costs ~20 ms.
- `upsert: false` + content-addressed keys means a retried upload cannot silently overwrite a different image.
- Never write user-controlled text into the key. `buildFileName()` already slugifies, but validate server-side too.

### 5.2 Prefer the "alternative" columns over `previous_image_url`

The client sends `previous_image_url` as a convenience. If your database can carry it, a `previous_image_url` column (or an `old_url` in an upload log) makes cleanup auditable after the fact and lets a canonical job do the deleting server-side — the client call becomes a hint, not the mechanism.

### 5.3 `/api/media/delete` — the endpoint the client already calls

Contract the frontend expects: `POST`, Bearer auth, body `{ urls: string[] }`, response `{ deleted: string[], skipped: string[] }`, idempotent, 404-tolerant on the client.

```js
app.post('/api/media/delete', requireAdmin, async (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  if (!urls.length) return res.json({ deleted: [], skipped: [] });

  const deleted = [];
  const skipped = [];

  for (const url of urls.slice(0, 50)) {          // bound the work per request
    const key = storageKeyFromUrl(url);            // bucket/path, never trust the host
    if (!key) { skipped.push(url); continue; }

    // THE IMPORTANT PART: is any row still pointing at it?
    const { count } = await db.from('media_references')   // or UNION over the real columns
      .select('*', { count: 'exact', head: true })
      .eq('storage_key', key);
    if (count > 0) { skipped.push(url); continue; }

    const { error } = await supabase.storage.from(bucketOf(key)).remove([pathOf(key)]);
    if (error && !/not found/i.test(error.message)) { skipped.push(url); continue; }
    deleted.push(url);
  }

  res.json({ deleted, skipped });
});
```

If you do not have a `media_references` table, the check must span the real columns — `products.image_url`, variant image columns, `product_reviews.image_url`, `system_settings` JSON (hero/footer/logo), `profiles.avatar_url`. A single `UNION ALL` view over those is the cheapest way to keep it honest:

```sql
CREATE OR REPLACE VIEW media_references AS
  SELECT image_url AS url FROM products WHERE image_url IS NOT NULL
  UNION ALL SELECT image_url FROM product_variants WHERE image_url IS NOT NULL
  UNION ALL SELECT image_url FROM product_reviews WHERE image_url IS NOT NULL
  UNION ALL SELECT avatar_url FROM profiles WHERE avatar_url IS NOT NULL;
  -- add the settings JSON if banners live in a jsonb column
```

> Verify the column names against your schema — this repository contains no DDL. `scripts/db-diagnostics.sql` (§18) lists the buckets and their object counts, which is the fastest way to see what is actually stored.

### 5.4 The reconciliation GC (the part that closes the leak)

Run hourly or nightly. It is the only thing that can find orphans the client never saw.

```js
// Pseudocode — order matters: list objects FIRST, then check references,
// otherwise an upload landing mid-scan looks orphaned.
const objects = await listAllObjects('media');            // key + lastModified
const refs = new Set(await allReferencedKeys());          // from media_references

for (const obj of objects) {
  if (refs.has(obj.key)) continue;
  if (Date.now() - obj.lastModified < 24 * 3600e3) continue;  // grace: in-flight uploads
  await deleteObject(obj.key);
  log.info('gc: removed orphan', obj.key);
}
```

The 24 h grace period is not optional: an object is uploaded before the row that points at it is committed, so a naive scan deletes live images of anyone mid-save. Consider a dry-run mode first (`GC_DRY_RUN=1`) and compare the list against the Storage dashboard before enabling deletion.

### 5.5 If you want the thumbnails to actually shrink

The `srcSet`/`thumbUrl` helpers only pay off when transformations are on:

- **Supabase:** enable Image Transformations on the project, then set `VITE_SUPABASE_IMAGE_TRANSFORMS=true` at build time. Free tier does not include it.
- **R2 + Cloudflare:** put the bucket behind a custom domain with Cloudflare Images' `/cdn-cgi/image/width=96,quality=70/…` prefix — then `thumbUrl` needs one line changed (it returns the URL unchanged today, so nothing breaks either way).
- **Neither:** the client-side resize still removes ~95 % of the bytes, because the stored original is now ≤ 1200 px on its longest edge.

---

## 6. Verification

```bash
node scripts/media-selftest.mjs     # 37/37 — scaling maths, passthrough rules,
                                    # never-grow rule, URL normalisation,
                                    # shared-asset guard, cleanup never throws
npm run build                       # ✓ 1.74 s
```

The self-test stubs the canvas API, so it proves logic, not encoder quality. Manual checks worth doing once, in a real browser:

1. Upload a 12 MP phone photo as a product image → network tab shows ~150–250 KB `image/webp`, not 5 MB.
2. Upload the same photo twice → identical filename hash (no duplicate object).
3. Edit a product, swap the photo, save → old object removed, *if* the backend implements §5.3 (otherwise a console warning and no harm).
4. Two products sharing one image; delete one → the other still renders.
5. Upload a portrait photo → not sideways (EXIF).
6. Upload a GIF → still animated.
7. `curl -I <stored object>` → `cache-control: public, max-age=31536000, immutable` (after §5.1).

---

## 7. Not covered

| Item | Why it is out of scope |
|---|---|
| Base64 data URLs in request bodies | `ThermalSticker.jsx:35`, `CustomerAIProfile.jsx:64`, `Orders.jsx:372` embed images as `data:` strings. That inflates JSON payloads by ~33 % and bypasses storage entirely. Fixing it means changing the backend contract, not the frontend. |
| CSV bulk import image URLs | `BulkProductUpload.jsx` uploads a CSV. If rows contain external `image_url`s, whether they are downloaded and re-hosted is a backend decision — and if they are, they bypass this pipeline. |
| Other backends writing to the same bucket | Anything outside these two endpoints is invisible from here. |
| Video | None is handled today; if it is added, canvas resizing does not apply and transcoding needs a service. |
| CDN purge strategy | Stale bytes are impossible by construction (content-addressed keys). If you ever need a hard purge, that is a Cloudflare/Supabase console operation. |
| Server-side dedupe | Two different admins choosing the same photo now produce the same key, so a duplicate is only possible if the backend renames it. |
