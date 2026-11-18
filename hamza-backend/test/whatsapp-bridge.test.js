import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { fromBaileys, fromWebJs, forwardReply } from '../bridge/linked-replies.mjs';

const phone = '15550100123';
const event = await fromWebJs({ fromMe: true, from: '15559999999@c.us', to: `${phone}@c.us`,
  type: 'chat', id: { id: 'phone-message-1' }, body: 'Yes, in stock.', timestamp: 1760000000 });
const db = new PGlite();
let upstream, remote, rpcCalls;
async function listen(app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
const close = server => new Promise(resolve => server.close(resolve));

// Real app, Supabase client and PostgreSQL migration. Only the hosted HTTP
// services are replaced. No live WhatsApp session, Graph call or real phone.
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table conversations (id serial primary key, platform text, external_id text, page_id text,
      unread_count int default 2, last_message text, last_message_at timestamptz);
    create table chat_messages (id serial primary key, conversation_id int references conversations(id),
      platform_message_id text, direction text, content text, created_at timestamptz, message_type text);`);
  await db.exec(await readFile(new URL('../migrations/004_whatsapp_bridge_replies.sql', import.meta.url), 'utf8'));

  const stub = express();
  stub.use(express.json());
  stub.get('/auth/v1/user', (_req, res) => res.json({ id: 'staff', app_metadata: { role: 'admin' } }));
  stub.post('/rest/v1/rpc/record_whatsapp_bridge_reply', async ({ body: p }, res) => {
    rpcCalls++;
    try {
      const { rows } = await db.query('select record_whatsapp_bridge_reply($1,$2,$3,$4,$5) as result',
        [p.p_customer_ids, p.p_page_id, p.p_message_id, p.p_content, p.p_created_at]);
      res.json(rows[0].result);
    } catch (err) { res.status(400).json({ code: err.code, message: err.message }); }
  });
  stub.get('/rest/v1/chat_messages', async (req, res) => {
    if (req.query.order !== 'created_at.desc.nullslast,id.desc') return res.sendStatus(400);
    const { rows } = await db.query(`select id, conversation_id, platform_message_id, direction, content, created_at, message_type
      from chat_messages where conversation_id = $1 order by created_at desc nulls last, id desc limit $2`,
    [req.query.conversation_id.slice(3), Number(req.query.limit)]);
    res.json(rows);
  });
  ({ server: upstream, url: remote } = await listen(stub));
});
after(async () => { if (upstream) await close(upstream); await db.close(); });
beforeEach(async () => {
  rpcCalls = 0;
  await db.exec('truncate chat_messages, conversations restart identity');
  await db.query(`insert into conversations(platform,external_id,page_id) values
    ('whatsapp',$1,'linked-shop'), ('whatsapp',$1,'other-shop'), ('messenger',$1,'linked-shop')`, [phone]);
});

async function api(t, config = {}) {
  const env = loadEnv({ SUPABASE_URL: remote, SUPABASE_SERVICE_ROLE_KEY: 'service', META_GRAPH_BASE: remote,
    WHATSAPP_BRIDGE_SECRET: 'test-bridge', WHATSAPP_BRIDGE_PAGE_ID: 'linked-shop', ...config });
  const { app } = createApp({ env, logger: { info() {}, warn() {}, error() {} } });
  const { server, url } = await listen(app);
  t.after(() => close(server));
  return { url, post: (body, auth = 'Bearer test-bridge') => fetch(`${url}/api/bridge/whatsapp/replies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: auth }) },
    body: JSON.stringify(body),
  }) };
}

test('business-phone reply survives refresh in a long customer thread; retries do not insert another bubble', async t => {
  const { post, url } = await api(t);
  await db.exec(`insert into chat_messages (conversation_id, direction, content, created_at, message_type)
    select 1,'inbound',i::text,to_timestamp(1700000000+i),'text' from generate_series(1,105) i`);
  const replies = await Promise.all([post(event), post(event)]);
  assert.deepEqual(replies.map(r => r.status).sort(), [200, 201]);
  assert.deepEqual((await Promise.all(replies.map(async r => (await r.json()).result))).sort(), ['duplicate', 'stored']);

  const res = await fetch(`${url}/api/chat/conversations/1/messages?limit=100`, { headers: { Authorization: 'Bearer test-admin' } });
  assert.equal(res.status, 200);
  const { messages } = await res.json();
  assert.equal(messages.length, 100);
  assert.equal(messages[0].content, '7');
  const last = messages.at(-1);
  assert.equal(last.direction, 'outbound');
  assert.equal(last.platform_message_id, event.id);
  assert.equal(last.content, event.text);
  assert.equal(last.created_at, new Date(event.timestamp * 1000).toISOString());

  const { rows } = await db.query('select last_message, unread_count from conversations order by id');
  assert.deepEqual(rows, [{ last_message: event.text, unread_count: 2 },
    { last_message: null, unread_count: 2 }, { last_message: null, unread_count: 2 }]);
});

test('delayed Baileys reply uses the mapped peer, not LID digits, and does not rewind the preview', async t => {
  const { post } = await api(t);
  assert.equal((await post(event)).status, 201);
  const late = fromBaileys({ key: { fromMe: true, id: 'older', remoteJid: '12345678@lid', remoteJidAlt: `${phone}:2@s.whatsapp.net` },
    messageTimestamp: String(event.timestamp - 60), message: { extendedTextMessage: { text: 'Earlier reply' } } });
  assert.equal((await post(late)).status, 201);
  const { rows } = await db.query('select content from chat_messages where conversation_id=1 order by created_at');
  assert.deepEqual(rows.map(r => r.content), ['Earlier reply', event.text]);
  assert.equal((await db.query('select last_message from conversations where id=1')).rows[0].last_message, event.text);
  assert.equal((await post({ ...event, peer: `${phone}@lid` })).status, 404, 'a LID is never guessed to be a phone number');
});

test('receiver is off by default, requires its own secret, rejects malformed/non-DM events before any RPC', async t => {
  const disabled = await api(t, { WHATSAPP_BRIDGE_SECRET: '' });
  assert.equal((await disabled.post(event, '')).status, 503);
  const { post } = await api(t);
  for (const auth of ['', 'Bearer test-admin', 'Bearer meta-token']) assert.equal((await post(event, auth)).status, 401);
  for (const invalid of [{ fromMe: false }, { fromMe: 'true' }, { peer: 'status@broadcast' }, { peer: '12345@g.us' },
    { peerAlt: '15551111111@c.us' }, { id: '' }, { text: '  ' }, { timestamp: Date.now() }]) {
    assert.equal((await post({ ...event, ...invalid })).status, 400);
  }
  assert.equal(rpcCalls, 0);
  const sig = 'public.record_whatsapp_bridge_reply(text[],text,text,text,timestamptz)';
  const { rows } = await db.query(`select has_function_privilege('anon', $1, 'EXECUTE') as anon,
    has_function_privilege('authenticated', $1, 'EXECUTE') as staff, has_function_privilege('service_role', $1, 'EXECUTE') as service`, [sig]);
  assert.deepEqual(rows[0], { anon: false, staff: false, service: true });
});

test('missing/ambiguous thread is not guessed or created; unset page ID only matches NULL', async t => {
  const { post } = await api(t, { WHATSAPP_BRIDGE_PAGE_ID: '' });
  assert.equal((await post(event)).status, 404);
  await db.query(`insert into conversations(platform, external_id) values ('whatsapp',$1), ('whatsapp',$2)`, [phone, `+${phone}`]);
  assert.equal((await post(event)).status, 409);
  assert.equal((await db.query('select count(*)::int as n from chat_messages')).rows[0].n, 0);
  await db.query('delete from conversations where external_id=$1', [`+${phone}`]);
  assert.equal((await post(event)).status, 201);
});

test('a failed preview update rolls back the insert, so replaying the same event can finish it', async t => {
  const { post } = await api(t);
  await db.exec('alter table conversations add constraint test_preview_failure check (last_message is null)');
  try {
    const failure = await post(event);
    assert.equal(failure.status, 503);
    assert.equal((await failure.json()).error.code, 'BRIDGE_WRITE_FAILED');
    assert.equal((await db.query('select count(*)::int as n from chat_messages')).rows[0].n, 0);
  } finally { await db.exec('alter table conversations drop constraint test_preview_failure'); }
  assert.equal((await post(event)).status, 201);
});

test('bridge hooks ignore incoming, group, receipt and media events; forwarding never treats an HTML/empty ack as success', async t => {
  assert.equal(fromBaileys({ key: { fromMe: false }, message: { conversation: 'incoming' } }), null);
  assert.equal(fromBaileys({ key: { fromMe: true, remoteJid: '1234@g.us', id: 'm' }, message: { conversation: 'group' } }), null);
  assert.equal(fromBaileys({ key: { fromMe: true, remoteJid: `${phone}@s.whatsapp.net` }, message: { protocolMessage: {} } }), null);
  assert.equal(await fromWebJs({ fromMe: true, type: 'image', body: 'media' }), null);
  const viaLid = await fromWebJs({ fromMe: true, type: 'chat', to: '12345678@lid', id: { id: event.id }, body: event.text, timestamp: event.timestamp },
    { getContactLidAndPhone: async ([lid]) => [{ lid, pn: `${phone}@c.us` }] });
  assert.equal(viaLid.peerAlt, `${phone}@c.us`);
  const config = { endpoint: 'https://api.example.test/api/bridge/whatsapp/replies', secret: 'test-bridge' };
  const send = t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer test-bridge');
    assert.deepEqual(JSON.parse(init.body), event);
    return Response.json({ success: true, result: 'stored' }, { status: 201 });
  });
  assert.equal(await forwardReply(event, config), 'stored');
  send.mock.mockImplementation(async () => new Response('<html></html>'));
  await assert.rejects(forwardReply(event, config));
});
