import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import express from 'express';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

const conversation = { id: 'c1', platform: 'whatsapp', page_id: '1234', external_id: '15550100123' };
const accepted = { messages: [{ id: 'wamid.test' }] };
const reply = { content: '  Yes, this fabric is in stock.  ' };

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

// Real admin auth, router, Graph client, error handler and repository;
// only the external Graph / Supabase HTTP services are replaced.
async function setup(t, opts = {}) {
  const thread = { ...conversation, ...opts.thread };
  const calls = [], writes = [], warnings = [];
  const upstream = express();
  upstream.use(express.json());
  upstream.get('/auth/v1/user', (_req, res) => res.json({ id: 'staff', app_metadata: { role: opts.role ?? 'admin' }, user_metadata: { role: 'admin' } }));
  upstream.get('/rest/v1/conversations', (req, res) => {
    const selected = req.query.select.split(',').map(key => [key, thread[key]]);
    res.json(req.query.id === `eq.${thread.id}` ? [Object.fromEntries(selected)] : []);
  });
  upstream.post('/v21.0/:sender/messages', (req, res) => {
    calls.push({ path: req.originalUrl, auth: req.headers.authorization, body: req.body });
    if (opts.dropConnection) return req.socket.destroy();
    res.status(opts.graphStatus || 200).json(opts.graphBody ?? accepted);
  });
  upstream.post('/rest/v1/chat_messages', (req, res) => {
    if (opts.dbFailure) return res.status(400).json({ code: 'TEST', message: 'insert failed' });
    writes.push(req.body);
    res.status(201).json({ id: 'm1', ...req.body });
  });
  upstream.patch('/rest/v1/conversations', (req, res) => { writes.push(req.body); res.sendStatus(204); });
  const remote = await listen(t, upstream);
  const env = loadEnv({ SUPABASE_URL: remote, SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    WHATSAPP_TOKEN: 'test-wa-token', META_GRAPH_BASE: remote, META_GRAPH_VERSION: 'v21.0', META_APP_SECRET: 'test-secret', ...opts.env });
  const logger = { info() {}, warn(...args) { warnings.push(args); }, error() {} };
  const { app } = createApp({ env, logger });
  const base = await listen(t, app);
  async function send(body = reply, { id = 'c1', auth = true } = {}) {
    const res = await fetch(`${base}/api/chat/conversations/${id}/messages`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: 'Bearer test-admin' }) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  }
  return { send, calls, writes, base, warnings };
}

test('inbox reply goes to the inbound sender via their business number and persists the accepted Meta ID', async t => {
  const { send, calls, writes } = await setup(t);
  const { status, body } = await send({ ...reply, to: 'ignored', phoneNumberId: 'ignored', accessToken: 'ignored' });
  assert.equal(status, 201);
  assert.deepEqual(calls, [{ path: '/v21.0/1234/messages', auth: 'Bearer test-wa-token',
    body: { messaging_product: 'whatsapp', to: conversation.external_id, type: 'text', text: { body: reply.content.trim() } } }]);
  assert.equal(writes[0].direction, 'outbound');
  assert.equal(writes[0].conversation_id, conversation.id);
  assert.equal(writes[0].platform_message_id, 'wamid.test');
  assert.equal(writes[1].last_message, reply.content.trim());
  assert.equal(body.message.platform_message_id, 'wamid.test');
});

test('older thread without page_id uses the configured business phone number ID', async t => {
  const { send, calls } = await setup(t, { thread: { page_id: null }, env: { WHATSAPP_PHONE_NUMBER_ID: '9876' } });
  assert.equal((await send()).status, 201);
  assert.equal(calls[0].path, '/v21.0/9876/messages');
});

for (const [name, opts, code] of [
  ['no WhatsApp token', { env: { WHATSAPP_TOKEN: '', META_PAGE_ACCESS_TOKEN: 'not-a-wa-token' } }, 'WHATSAPP_NOT_CONFIGURED'],
  ['no business number', { thread: { page_id: null } }, 'WHATSAPP_NOT_CONFIGURED'],
  ['different configured number', { env: { WHATSAPP_PHONE_NUMBER_ID: '9876' } }, 'WHATSAPP_NUMBER_MISMATCH'],
  ['no recipient', { thread: { external_id: null } }, 'WHATSAPP_NO_RECIPIENT'],
  ['no server-assigned admin role', { role: '' }, 'UNAUTHORIZED'],
]) {
  test(`${name}: no WhatsApp call or local sent message`, async t => {
    const { send, writes, calls } = await setup(t, opts);
    const { body } = await send();
    assert.equal(body.success, false);
    assert.equal(body.error.code, code);
    assert.deepEqual(calls, []);
    assert.deepEqual(writes, []);
  });
}

test('unauthenticated, blank, oversize and unknown-thread requests cannot dispatch a reply', async t => {
  const { send, calls, writes } = await setup(t);
  assert.equal((await send(reply, { auth: false })).status, 401);
  assert.equal((await send({ content: ' ' })).status, 400);
  assert.equal((await send({ content: 'x'.repeat(4097) })).status, 400);
  assert.equal((await send(reply, { id: 'missing' })).status, 404);
  assert.deepEqual(calls, []);
  assert.deepEqual(writes, []);
});

test('Meta rejection is actionable but does not leak raw provider text or save a phantom reply', async t => {
  const { send, writes, calls, warnings } = await setup(t, { graphStatus: 400,
    graphBody: { error: { code: 131047, message: 'private provider data' } } });
  const { status, body } = await send();
  assert.equal(status, 502);
  assert.equal(body.success, false);
  assert.match(body.error.message, /24-hour reply window/);
  assert.doesNotMatch(JSON.stringify([body, warnings]), /private provider data|test-wa-token/);
  assert.equal(calls.length, 1);
  assert.deepEqual(writes, []);
});

for (const [name, opts] of [['no message ID', { graphBody: {} }], ['lost response', { dropConnection: true }]]) {
  test(`${name}: report an unconfirmed send without retrying or recording it as sent`, async t => {
    const { send, calls, writes } = await setup(t, opts);
    assert.equal((await send()).body.error.code, 'WHATSAPP_UNCONFIRMED');
    assert.equal(calls.length, 1);
    assert.deepEqual(writes, []);
  });
}

test('accepted but not saved: warn instead of asking for a duplicate send', async t => {
  const { send, calls } = await setup(t, { dbFailure: true });
  const { status, body } = await send();
  assert.equal(status, 202);
  assert.equal(body.success, true);
  assert.match(body.warning, /Do not resend/);
  assert.equal(body.platform_message_id, 'wamid.test');
  assert.equal(calls.length, 1);
});

test('non-WhatsApp replies keep the existing contract and never dispatch to WhatsApp', async t => {
  const { send, calls } = await setup(t, { thread: { platform: 'messenger' } });
  const { status, body } = await send();
  assert.equal(status, 201);
  assert.equal(body.message.content, reply.content.trim());
  assert.deepEqual(calls, []);
});

test('a signed asynchronous delivery failure logs the Meta ID and error code, not personal data', async t => {
  const { base, warnings, writes } = await setup(t);
  const payload = JSON.stringify({ entry: [{ changes: [{ field: 'messages', value: { statuses: [{
    id: 'wamid.test', status: 'failed', recipient_id: conversation.external_id, errors: [{ code: 131047 }],
  }] } }] }] });
  const sig = createHmac('sha256', 'test-secret').update(payload).digest('hex');
  const res = await fetch(`${base}/api/webhooks/whatsapp`, { method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${sig}` } });
  assert.equal(res.status, 200);
  assert.deepEqual(warnings, [['WhatsApp delivery failed', { platformMessageId: 'wamid.test', code: 131047 }]]);
  assert.deepEqual(writes, []);
});
