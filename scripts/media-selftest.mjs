/**
 * Self-test for the media pipeline (src/lib/imageOptimize.js + mediaClient.js).
 *
 *   node scripts/media-selftest.mjs
 *
 * The canvas API is stubbed, so this checks *logic* — scaling maths, the
 * "never grow a file" rule, passthrough rules, URL normalisation, the
 * shared-asset guard, and that cleanup can never throw — not real encoder
 * quality. Run it after touching either module; a real browser is still the
 * only way to judge output quality.
 */

const img = await import('../src/lib/imageOptimize.js');
const media = await import('../src/lib/mediaClient.js');
const { optimizeImage, prepareImageForUpload, buildFileName, describeSaving,
        UPLOAD_PRESETS, MAX_SOURCE_BYTES, ImageTooLargeError } = img;
const { MEDIA_CACHE_CONTROL, appendStorageFields, toStorageKey, isSameMedia,
        isUrlStillReferenced, deleteMedia } = media;

const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

console.log('\n── imageOptimize ──────────────────────────────────────────────');
// Stub just enough DOM for the canvas pipeline, then exercise every rule.
const drawCalls = [];
let canvasCount = 0;

function makeCanvas() {
  canvasCount++;
  const c = {
    width: 0, height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: (src, sx, sy, w, h) => { drawCalls.push({ src: src.__id, w, h }); },
    }),
    // simulate a webp encoder: bytes proportional to pixels, ~0.12 B/px
    toBlob: (cb, mime) => {
      const pixels = c.width * c.height;
      const blob = new Blob([new Uint8Array(Math.round(pixels * 0.12))], { type: mime });
      setTimeout(() => cb(blob), 0);
    },
  };
  return c;
}

globalThis.document = { createElement: (tag) => (tag === 'canvas' ? makeCanvas() : {}) };

let bitmapDims = { width: 4000, height: 3000 };
globalThis.createImageBitmap = async () => ({
  __id: 'bitmap',
  width: bitmapDims.width,
  height: bitmapDims.height,
  close: () => {},
});


const fileOf = (name, type, size) => new File([new Uint8Array(size)], name, { type });

// 1. Large PNG (8 MB, 4000x3000) -> 1600x1200 webp, smaller
bitmapDims = { width: 4000, height: 3000 };
let f = fileOf('shirt photo.PNG', 'image/png', 8 * 1024 * 1024);
let out = await optimizeImage(f, 'product');
check('downscales 4000x3000 to 1200x900 (house cap)', out !== f && out.type === 'image/webp',
      `${out.name} ${out.type} ${out.size}B`);
check('output is smaller than input', out.size < f.size, `${f.size} -> ${out.size}`);
check('filename is content-addressed + slugified', /^shirt-photo-[0-9a-f]{16}\.webp$/.test(out.name), out.name);
check('two-pass downscale used (scale 0.4 < 0.5)', canvasCount >= 2, `${canvasCount} canvases`);
const lastDraw = drawCalls[drawCalls.length - 1];
check('final draw target is 1200x900', lastDraw.w === 1200 && lastDraw.h === 900, JSON.stringify(lastDraw));

// 2. Already-small modern image -> passthrough
bitmapDims = { width: 96, height: 96 };
f = fileOf('swatch.webp', 'image/webp', 50 * 1024);
out = await optimizeImage(f, 'variant');
check('small webp passes through untouched', out === f, out.name);

// 3. Animated GIF / SVG -> passthrough (never destroy animation)
f = fileOf('anim.gif', 'image/gif', 3 * 1024 * 1024);
check('GIF passes through untouched', (await optimizeImage(f, 'product')) === f);
f = fileOf('logo.svg', 'image/svg+xml', 20 * 1024);
check('SVG passes through untouched', (await optimizeImage(f, 'product')) === f);

// 4. Non-image -> passthrough
f = fileOf('invoice.pdf', 'application/pdf', 100000);
check('non-image passes through untouched', (await optimizeImage(f, 'product')) === f);

// 5. Oversized source -> throws a typed, user-facing error
f = fileOf('huge.jpg', 'image/jpeg', MAX_SOURCE_BYTES + 1);
let threw = null;
try { await optimizeImage(f, 'product'); } catch (e) { threw = e; }
check('oversized source throws ImageTooLargeError', threw instanceof ImageTooLargeError, threw?.message);
let prepThrew = null;
try { await prepareImageForUpload(f, 'product'); } catch (e) { prepThrew = e; }
check('prepareImageForUpload surfaces the size error', prepThrew instanceof ImageTooLargeError);

// 6. Encoder produced something BIGGER -> keep original ("never make it bigger")
bitmapDims = { width: 2000, height: 2000 };
f = fileOf('tiny-but-big-dims.jpg', 'image/jpeg', 1000); // 1 KB input, encoder will "produce" 480 KB
out = await optimizeImage(f, 'product');
check('never ships a larger file than the original', out === f, `${out.size} vs ${f.size}`);

// 7. Undecodable file -> original, never throws
globalThis.createImageBitmap = async () => { throw new Error('decode fail'); };
globalThis.Image = class { set src(_) { setTimeout(() => this.onerror?.(new Error('nope')), 0); } };
globalThis.URL.createObjectURL = () => 'blob:fake';
globalThis.URL.revokeObjectURL = () => {};
f = fileOf('corrupt.heic', 'image/heic', 500000);
out = await optimizeImage(f, 'product');
check('undecodable image falls back to the original', out === f);

// 8. Presets never exceed the hard clamp
check('every preset capped at 1200 px and quality 0.80',
      Object.values(UPLOAD_PRESETS).every(p => p.maxWidth <= 1200 && p.maxHeight <= 1200 && p.quality === 0.80));
check('avatar is smaller than the standard', UPLOAD_PRESETS.avatar.maxWidth < UPLOAD_PRESETS.product.maxWidth);

// 9. helpers
check('buildFileName strips dangerous chars',
      buildFileName('../../etc/pass wd.JPG', 'abc123', 'webp') === 'etc-pass-wd-abc123.webp',
      buildFileName('../../etc/pass wd.JPG', 'abc123', 'webp'));
check('describeSaving formats MB -> KB',
      describeSaving(5 * 1024 * 1024, 180 * 1024) === '5.0 MB → 180 KB (96% smaller)',
      describeSaving(5 * 1024 * 1024, 180 * 1024));


console.log('\n── mediaClient ────────────────────────────────────────────────');

// appendStorageFields
const fd = new FormData();
const file = new File([new Uint8Array(10)], 'a-1a2b.webp', { type: 'image/webp' });
appendStorageFields(fd, file);
check('sets cache_control', fd.get('cache_control') === MEDIA_CACHE_CONTROL, String(fd.get('cache_control')));
check('sets content_type from file', fd.get('content_type') === 'image/webp');
check('sets file_name', fd.get('file_name') === 'a-1a2b.webp');
check('cache control is 1 year', MEDIA_CACHE_CONTROL === '31536000');

// toStorageKey
check('toStorageKey extracts bucket/path, drops query',
      toStorageKey('https://xyz.supabase.co/storage/v1/object/public/product-images/a/b.webp?sig=1') === 'product-images/a/b.webp',
      String(toStorageKey('https://xyz.supabase.co/storage/v1/object/public/product-images/a/b.webp?sig=1')));
check('toStorageKey handles unencoded space', toStorageKey('https://x.supabase.co/storage/v1/object/public/b/blue shirt.webp') === 'b/blue shirt.webp');
check('toStorageKey rejects data URLs', toStorageKey('data:image/png;base64,AAA') === null);
check('toStorageKey keeps relative upload paths', toStorageKey('/uploads/img.webp') === 'uploads/img.webp');

// isSameMedia
check('isSameMedia ignores query string',
      isSameMedia('https://x.supabase.co/a.webp?v=1', 'https://x.supabase.co/a.webp?v=2'));
check('isSameMedia differs on path', !isSameMedia('https://x.supabase.co/a.webp', 'https://x.supabase.co/b.webp'));
check('isSameMedia handles null', !isSameMedia(null, 'x'));

// isUrlStillReferenced — the safety net that stops shared assets being deleted
const records = [
  { id: 1, image_url: 'https://s/x/shirt.webp', variant_images: ['https://s/x/red.webp'] },
  { id: 2, image_url: 'https://s/x/shirt.webp' },
];
check('shared image still referenced by another row',
      isUrlStillReferenced('https://s/x/shirt.webp', records, ['image_url', 'variant_images'], [1]));
check('variant array entry blocks deletion by another row',
      isUrlStillReferenced('https://s/x/red.webp', records, ['variant_images'], [2]));
check('variant array entry counts on its own row when not excluded',
      isUrlStillReferenced('https://s/x/red.webp', records, ['variant_images'], []));
check('truly orphaned image is deletable',
      !isUrlStillReferenced('https://s/x/old.webp', records, ['image_url', 'variant_images'], [1]));
check('same row excluded does not count itself',
      !isUrlStillReferenced('https://s/x/red.webp', records, ['variant_images'], [1, 2]));

// deleteMedia — must never throw, must tolerate a missing endpoint
let calls = [];
globalThis.fetch = async (url, opts) => { calls.push({ url, body: opts.body }); return { ok: true, status: 200, json: async () => ({}) }; };
await deleteMedia(['https://s/x/a.webp']);
check('posts to /api/media/delete with urls array',
      calls[0].url === '/api/media/delete' && JSON.parse(calls[0].body).urls.length === 1, calls[0].url);

globalThis.fetch = async () => ({ ok: false, status: 404 });
let cleanupThrew = null; try { await deleteMedia(['https://s/x/a.webp']); } catch (e) { cleanupThrew = e; }
check('404 (endpoint not deployed) is tolerated', cleanupThrew === null);

globalThis.fetch = async () => { throw new Error('network down'); };
cleanupThrew = null; try { await deleteMedia(['https://s/x/a.webp']); } catch (e) { cleanupThrew = e; }
check('network failure is swallowed', cleanupThrew === null);

// The hamza-backend route answers 200 with per-URL reasons; a refusal is not an error.
const backendUrl = 'https://s/x/kept.webp';
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    success: true,
    deleted: [],
    skipped: [backendUrl],
    reasons: { [backendUrl]: 'referenced' },
  }),
});
const swept = await deleteMedia([backendUrl]);
check('accepts the backend {deleted,skipped} shape', swept.deleted.length === 0 && swept.skipped[0] === backendUrl);
check('surfaces per-URL reasons for debugging', swept.reasons?.[backendUrl] === 'referenced');

globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
cleanupThrew = null; try { await deleteMedia(['https://s/x/a.webp']); } catch (e) { cleanupThrew = e; }
check('401 (admin token not accepted) is tolerated', cleanupThrew === null);

calls = []; globalThis.fetch = async (u, o) => { calls.push(u); return { ok: true, status: 200 }; };
let sentBody = null;
globalThis.fetch = async (u, o) => { calls.push(u); sentBody = JSON.parse(o.body); return { ok: true, status: 200 }; };
await deleteMedia([null, '', 'data:image/png;base64,AA', 'blob:xyz', 'https://s/x/ok.webp']);
check('filters out null/data/blob URLs before sending',
      calls.length === 1 && sentBody.urls.length === 1 && sentBody.urls[0] === 'https://s/x/ok.webp',
      JSON.stringify(sentBody?.urls));
await deleteMedia([]); await deleteMedia(null);
check('empty/none input makes no request', calls.length === 1);


const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
