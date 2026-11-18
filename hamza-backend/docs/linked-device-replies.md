# Show replies from a QR-linked WhatsApp phone in Unified Inbox

This is **phone → website** sync for direct **text replies in existing customer chats**. A message has already been sent; the receiver only records it. It doesn't pair a device, send through Meta, download attachments or import the phone's history. Leave the working incoming-customer handler in place.

## Connect the running bridge

1. **Check the incoming side first.** Send a message from a test customer phone. Find its WhatsApp conversation in Unified Inbox. The customer's `external_id` and the linked shop's `page_id` on that row are the routing keys. No match or multiple matches is an error, not a reason to guess or create another chat.
2. **Deploy to the API that serves that inbox, using the same database.** Run `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f hamza-backend/migrations/004_whatsapp_bridge_replies.sql` (from the repo root), then deploy the updated chat backend and admin site. Migration 004 adds a service-role-only function; it does not rewrite historical messages. If the production API is separate from `hamza-backend/`, mount the receiver in that API and port the newest-first history query there. Deploying the static site alone is not enough.
3. **Set server environment variables** and restart the affected processes:

   | Setting | Where | Value |
   | --- | --- | --- |
   | `WHATSAPP_BRIDGE_SECRET` | API **and** QR bridge | The same dedicated random secret (e.g. generate with `openssl rand -hex 32`). Empty disables the receiver. Not a Meta token, Supabase key or staff login. |
   | `WHATSAPP_BRIDGE_PAGE_ID` | API only | The exact `page_id` stored by the incoming bridge for this linked account. Leave empty **only for NULL**. It is not a wildcard. Only enable this for a single linked account per scope. |
   | `WHATSAPP_BRIDGE_REPLY_URL` | QR bridge only | `https://<your-inbox-api>/api/bridge/whatsapp/replies` — the API, not the static website. |

   None of these belong in `VITE_*`, the browser, source control or chat.
4. **Forward the device's own message events.** The running QR service is not part of this checkout. In its `package.json`, look for `whatsapp-web.js` or `@whiskeysockets/baileys`. Copy [`bridge/linked-replies.mjs`](../bridge/linked-replies.mjs) to that service and attach the matching listener **once** to the existing client. No new session or QR scan is needed for this change.

   ```js
   import { fromWebJs, fromBaileys, forwardReply } from './linked-replies.mjs';

   async function sync(event) {
     if (!event) return; // incoming, non-text, group, status, etc.
     try { await forwardReply(event); }
     catch (err) {
       console.error('Inbox sync failed:', err.message); // not the event or secret
       // In production, use the bridge's retry queue for transient failures.
       // Retry this HTTP event with the same id, NOT the WhatsApp send.
     }
   }

   // whatsapp-web.js: 'message' alone excludes the account's own messages.
   client.on('message_create', async msg => sync(await fromWebJs(msg, client)));

   // OR Baileys: observe all messages in the batch before any fromMe filter.
   sock.ev.on('messages.upsert', async ({ messages }) => {
     for (const msg of messages) await sync(fromBaileys(msg));
   });
   ```

   For a hosted or custom bridge, use its **outgoing/sent-message** webhook and map it to the HTTP contract below. A delivery/read receipt is not a message. If the service never exposes messages sent by the phone, the website cannot reconstruct them.

## HTTP contract (other bridges)

`POST /api/bridge/whatsapp/replies` over HTTPS. Send `Content-Type: application/json` and `Authorization: Bearer <WHATSAPP_BRIDGE_SECRET>` **from the bridge server**. Example body:

```json
{"fromMe":true,"id":"stable-device-message-id","peer":"15550100123@c.us","timestamp":1760000000,"text":"Yes, this fabric is in stock."}
```

- `peer` is the **recipient/customer** (`to` or `key.remoteJid`), not the sending shop. Direct phone IDs, `@c.us` and `@s.whatsapp.net` are supported. A `@lid` may match its own stored LID, **never** a phone number with the same digits. If the bridge knows both addresses, it can include the provider-mapped alternate in `peerAlt`; don't invent a phone number from a LID.
- Use the original stable WhatsApp message `id` and send `timestamp` in **Unix seconds**, not milliseconds. The insert and preview update commit together. Retries don't add another bubble, old events don't displace a newer preview, and own replies don't increment unread counts.
- `201 stored`: committed. `200 duplicate`: already present; stop retrying. `400`: check the event mapping. `401`: check the shared secret. `404`: check the receiver URL, incoming thread, customer ID and linked account scope. `409`: ambiguous thread; resolve the mapping before retrying. `503`: receiver disabled or database write failed; check the API configuration and migration. After fixing a failure, replay the **event**, never resend the text to the customer.

## Verify on two phones

Reply to the test customer from the business phone or WhatsApp Web, **not** from the website composer. The bridge should receive `201`. Return to the Unified Inbox tab or click **Refresh inbox**: the reply should appear once on the outgoing side of the same customer thread, even if the thread has more than 100 messages. Reload to confirm it persisted. A separate production socket broadcaster can still push `chat:new_message`; Refresh works without it. Messages the bridge never forwarded aren't automatically backfilled.
