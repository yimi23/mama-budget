// The ChatGPT app end to end in one process: a fake Mama API, the MCP server over Streamable HTTP, an MCP client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const seen = [];
const fakeApi = createServer((req, res) => {
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    seen.push({ path: req.url, auth: req.headers.authorization, body: raw });
    const out = req.url === '/me' ? { ok: true, plan: 'open' }
      : req.url === '/week' ? { budget: 300, spent: 120, left: 180, daysLeft: 3, jar: 410, streak: 3 }
      : req.url === '/shelf' ? { ok: true, shelf: [{ requestId: 'a', item: 'AirPods Pro', amount: 249, store: 'bestbuy.com', date: '2026-10-06', still: false }] }
      : req.url === '/v2/judge' ? { ok: true, verdicts: [{ label: 'ask', line: 'AirPods for $249. What are they for, hon?', sub: '$249 against $180 left this week.' }], week: { left: 180, budget: 300 } }
      : { ok: false };
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out));
  });
});
await new Promise((r) => fakeApi.listen(0, r));
process.env.MAMA_API = `http://localhost:${fakeApi.address().port}`;
const { listen, tokenFor } = await import('../server.mjs');
const app = await listen(0);
const url = new URL(`http://localhost:${app.address().port}/mcp`);

test('the three tools are listed with the card, read-only, and both security schemes', async () => {
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(url));
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['shelf_items', 'week_left', 'weigh_purchase']);
  for (const t of tools) {
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t._meta['openai/outputTemplate'], 'ui://mama-budget/card.html');
    assert.equal(t._meta.ui.resourceUri, 'ui://mama-budget/card.html');
  }
  const { resources } = await client.listResources();
  assert.ok(resources.some((r) => r.uri === 'ui://mama-budget/card.html'));
  const card = await client.readResource({ uri: 'ui://mama-budget/card.html' });
  assert.match(card.contents[0].mimeType, /text\/html/);
  assert.match(card.contents[0].text, /window\.openai/);
  await client.close();
});

test('each tool calls the Mama API as the subject\'s own user and returns text plus structured content', async () => {
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(url));
  seen.length = 0;
  const week = await client.callTool({ name: 'week_left', arguments: {}, _meta: { 'openai/subject': 'subj-1' } });
  assert.equal(week.structuredContent.left, 180);
  assert.match(week.content[0].text, /\$180 left this week\. 3 days to go\./);
  assert.ok(seen.every((s) => s.auth === `Bearer ${tokenFor('subj-1')}`), 'every call carries the derived token');
  assert.ok(!seen.some((s) => s.auth.includes('subj-1')), 'the subject itself never reaches the API');
  const weigh = await client.callTool({ name: 'weigh_purchase', arguments: { item: 'AirPods Pro', price: 249, store: 'bestbuy.com' } });
  assert.equal(weigh.structuredContent.label, 'ask');
  assert.match(weigh.content[0].text, /What are they for/);
  const judged = seen.find((s) => s.path === '/v2/judge');
  assert.equal(JSON.parse(judged.body).items[0].unitPrice, 249);
  const shelf = await client.callTool({ name: 'shelf_items', arguments: {} });
  assert.equal(shelf.structuredContent.total, 249);
  assert.match(shelf.content[0].text, /AirPods Pro \$249/);
  await client.close();
  app.close(); fakeApi.close();
});
