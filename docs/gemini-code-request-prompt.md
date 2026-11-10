# Gemini-কে দেওয়ার প্রম্পট (কোড/ডেটা বের করার জন্য)

দুইটা প্রম্পট। **প্রম্পট ১** হলো মূল — এটা দিয়ে জেমিনি আপনার প্রজেক্টের দরকারি ফাইলগুলো বের করে দেবে।
**প্রম্পট ২** তখন ব্যবহার করুন যখন কোড শেয়ার করা সম্ভব না, শুধু সমস্যাটা কোথায় সেটা প্রমাণ করতে চান।

> ⚠️ জেমিনিকে অবশ্যই আপনার **প্রজেক্টের ফাইল পড়ার অ্যাক্সেস** দিতে হবে (Google AI Studio-র "Code" / project upload, Antigravity, Cursor, বা Gemini CLI / Claude Code-এর মতো টুল)। শুধু চ্যাটে প্রম্পট পেস্ট করলে সে ফাইল দেখতে পাবে না — তখন ২ নম্বর প্রম্পট বা টার্মিনাল আউটপুট ব্যবহার করুন।

---

## প্রম্পট ১ — সোর্স কোড এক্সট্রাকশন (কপি করে জেমিনিতে দিন)

```
You are extracting source code from my project so another developer can fix a bug.
Do NOT explain, do NOT refactor, do NOT suggest fixes, do NOT summarize. Only output file contents.

CONTEXT
- React + Vite admin dashboard, talks to a REST API.
- Bug: in the product edit modal, saving with an image fails with the toast
  "Failed to update product." The request is a multipart/form-data PUT to /api/products/:id.
- The modal contains these exact UI strings: "Edit Directory Configuration",
  "MAIN IMAGE UPLOAD", "AI FOCAL POINT", "AUTO-FILL WITH AI BRAIN",
  "DETAILED DESCRIPTION", "PRICING & STOCK MAP", "Save Product", "Cancel".

STEP 1 — SEARCH the whole repository for these strings and identifiers:
  "AI FOCAL POINT", "AUTO-FILL WITH AI BRAIN", "Save Product", "variantImage_",
  "FormData(", "createObjectURL", "image_url", "multer", "upload.single",
  "fileSize", "client_max_body_size"

STEP 2 — OUTPUT, in exactly this order, every file that exists, in full, using this format:

=== FILE: <relative/path/from/repo/root> ===
```<language>
<complete raw file contents, no truncation, no comments added>
```

FILES I NEED (skip any that do not exist, keep this order):
1. The component that renders the product edit modal (the file containing "AI FOCAL POINT").
2. Every file that component imports which deals with file/image selection, focal point,
   building FormData, or calling the products API.
3. The API client and config file that define the API base URL
   (e.g. src/config/api.js, src/utils/apiClient.js, src/utils/auth.js).
4. BACKEND: the route + controller/handler for POST /api/products and PUT /api/products/:id,
   including the multer / express-fileupload / formidable configuration, upload directory
   setup, and any image resize step.
5. BACKEND entry file ONLY if it configures body-size limits, static /uploads serving, or CORS
   (server.js / app.js / index.js).
6. Deployment config: nginx.conf, docker-compose.yml, Dockerfile, vercel.json, .env.example.
7. package.json (frontend, and backend if it exists).

STRICT RULES
- No prose before, between, or after files. No "here is the file".
- Redact all secrets: JWT tokens, DB URLs/passwords, API keys, webhook URLs, real customer
  data -> <REDACTED>. For .env files keep only variable names with placeholder values.
- If a file is longer than 400 lines, output only the section that handles upload/save plus
  30 lines of context around it, labelled:
  === PARTIAL: <path> (lines X-Y of N) ===
- If you searched but found nothing for an item, write exactly:
  === NOT FOUND: <item> (searched: <terms>) ===
- Total output budget ~1500 lines. Prioritise items 1-4. If you must cut, cut item 7 first.
- Never invent code. If you cannot read the filesystem, reply only with:
  NO_FILESYSTEM_ACCESS
```

---

## প্রম্পট ২ — কোড ছাড়া শুধু কারণ প্রমাণ করা (ব্রাউজার কনসোলে চালান)

লগইন করা অ্যাডমিন ট্যাবে F12 → Console খুলে নিচেরটা চালান। এটা **কোনো ডেটা বদলায় না** — শুধু দেখে
সার্ভার কত সাইজের বডি নেয়।

```js
// Body-size limit probe (harmless: does not touch any product)
const api = (import.meta?.env?.VITE_API_URL) || location.origin; // পেজে import.meta না চললে location.origin রাখুন
for (const mb of [1, 2, 4, 8, 16]) {
  try {
    const r = await fetch(api + '/api/__size_probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(mb * 1024 * 1024),
    });
    console.log(`${mb} MB -> HTTP ${r.status}`, (await r.text()).slice(0, 120));
  } catch (e) {
    console.log(`${mb} MB -> network error:`, e.message);
  }
}
```

কী বোঝা যাবে:

| রেজাল্ট | অর্থ |
|---|---|
| `1 MB -> HTTP 413` | nginx-এর ডিফল্ট ১ MB লিমিট → এটাই মূল কারণ |
| ১-২ MB OK, `4 MB -> 413` | Vercel/Cloudflare-এর ৪.৫ MB লিমিট |
| সব সাইজ 413 / connection reset | সার্ভার বা WAF লিমিট আরও কম |
| সব 404/405 | লিমিট নেই → সমস্যা ব্যাকএন্ড কোডে (multer config / পারমিশন / রুট) |
| সব `network error` | CORS / API URL ভুল / সার্ভার ডাউন |

---

## প্রম্পট ৩ — ফেল করা রিকোয়েস্টের আসল কারণ (ঐচ্ছিক)

```
I need to know exactly why my product save fails. Do NOT change any code, only tell me the steps.
My app is a React admin dashboard at a URL, opened in Chrome on my computer (or Android via USB debugging).
Walk me through, step by step, how to:
1. Open DevTools Network tab, filter to "products", and capture the failing PUT request.
2. Copy the request's Status Code, Response Headers (content-type, server), and Response body.
3. Tell me what to look for: 413 vs 401 vs 500 vs CORS, and what each implies.
4. How to check the same on an iPhone (Safari Web Inspector needs a Mac) - give the
   simplest alternative if I have no Mac: a temporary fetch() snippet in the console that
   logs status + response text for the same multipart PUT.
Give the snippet ready to paste, with a placeholder for the product ID and the token,
and make sure it does NOT permanently modify any product data.
```
