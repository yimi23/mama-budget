// Mama Budget as a ChatGPT app: an MCP server over Streamable HTTP that calls the Mama API. docs/research/CHATGPT_APP.md.
//
// Three read tools and one card: how much is left this week, weigh a purchase (her verdict and line), what is on the
// shelf. Each ChatGPT user is a Mama user: the anonymized subject ChatGPT sends becomes a device token, so a person
// who only ever meets her in ChatGPT still gets their own envelope. Linking that to the extension's account needs
// OAuth on the API, which is not built; both security schemes are declared so linking can be added without a new app.
//
// ChatGPT forbids selling or promoting subscriptions inside an app, so nothing here mentions a price. A locked plan
// reads as one sentence and a link to the site.
//
//   MAMA_API=http://localhost:8787 MAMA_CHATGPT_PORT=8790 node apps/chatgpt/server.mjs
//   Test from ChatGPT: chatgpt.com/plugins > Add custom MCP server > https://<public host>/mcp

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

const API = (process.env.MAMA_API || 'http://localhost:8787').replace(/\/$/, '');
const PORT = Number(process.env.MAMA_CHATGPT_PORT || 8790);
const SITE = process.env.MAMA_SITE || 'https://mamabudget.com';
const CARD = 'ui://mama-budget/card.html';
const cardHtml = readFileSync(new URL('./card.html', import.meta.url), 'utf8');

/** The Mama user behind a ChatGPT subject: a device token derived from it, never the subject itself. */
export function tokenFor(subject) {
  const s = String(subject || 'anonymous');
  return `chatgpt:${createHash('sha256').update(`mama-chatgpt:${s}`).digest('hex').slice(0, 40)}`;
}
function subjectOf(extra) {
  const meta = extra?._meta || {};
  return meta['openai/subject'] || meta.subject || 'anonymous';
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const money = (n) => `$${Math.round(n || 0)}`;

/** One tool answer: what the model reads, what the card gets. */
const answer = (text, structured) => ({ content: [{ type: 'text', text }], structuredContent: structured });

export function buildServer() {
  const mcp = new McpServer({ name: 'mama-budget', version: '0.1.0' });

  registerAppResource(mcp, 'card', CARD, {}, async () => ({
    contents: [{ uri: CARD, mimeType: RESOURCE_MIME_TYPE, text: cardHtml, _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } }, 'openai/widgetDescription': 'This week’s envelope and what she said.' } }],
  }));

  const common = {
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: 'noauth' }, { type: 'oauth2', scopes: ['budget:read'] }],
    _meta: { ui: { resourceUri: CARD }, 'openai/outputTemplate': CARD, 'openai/toolInvocation/invoking': 'Asking her…', 'openai/toolInvocation/invoked': 'She has spoken' },
  };

  registerAppTool(mcp, 'week_left', {
    title: 'How much is left this week',
    description: 'Use when the user asks what is left in their weekly fun money, how the week is going, or how much they have kept. Returns the envelope, what is spent, what is left, days to go, the kept jar and the streak.',
    inputSchema: {},
    outputSchema: { kind: z.literal('week'), envelope: z.number(), spent: z.number(), left: z.number(), daysLeft: z.number(), jar: z.number(), streak: z.number(), line: z.string(), locked: z.boolean() },
    ...common,
  }, async (_args, extra) => {
    const token = tokenFor(subjectOf(extra));
    const me = await api('/me', { token }).catch(() => ({ plan: 'open' }));
    if (me.plan === 'locked') return answer(`Her week is paused on this account. ${SITE} has the details.`, { kind: 'week', envelope: 0, spent: 0, left: 0, daysLeft: 0, jar: 0, streak: 0, line: 'Her week is paused on this account.', locked: true });
    const w = await api('/week', { token });
    const line = `${money(w.left)} left this week. ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'} to go.`;
    return answer(`${line} ${money(w.spent)} of ${money(w.budget)} gone.${w.jar ? ` The jar is ${money(w.jar)}.` : ''}${w.streak >= 2 ? ` ${w.streak} weeks kept in a row.` : ''}`, { kind: 'week', envelope: Math.round(w.budget), spent: Math.round(w.spent), left: Math.round(w.left), daysLeft: w.daysLeft, jar: Math.round(w.jar || 0), streak: w.streak || 0, line, locked: false });
  });

  registerAppTool(mcp, 'weigh_purchase', {
    title: 'Weigh a purchase',
    description: 'Use when the user asks whether to buy something, names an item with a price, or asks what she would say. Returns her verdict for the item against this week’s envelope and her one line.',
    inputSchema: { item: z.string().describe('What it is, as the store names it'), price: z.number().describe('The price in dollars'), store: z.string().optional().describe('The store, if known') },
    outputSchema: { kind: z.literal('verdict'), item: z.string(), price: z.number(), label: z.string(), line: z.string(), sub: z.string(), left: z.number(), envelope: z.number(), locked: z.boolean() },
    ...common,
  }, async ({ item, price, store }, extra) => {
    const token = tokenFor(subjectOf(extra));
    const me = await api('/me', { token }).catch(() => ({ plan: 'open' }));
    if (me.plan === 'locked') return answer(`Her week is paused on this account. ${SITE} has the details.`, { kind: 'verdict', item, price, label: 'paused', line: 'Her week is paused on this account.', sub: '', left: 0, envelope: 0, locked: true });
    const r = await api('/v2/judge', { method: 'POST', token, body: { store: store || 'chatgpt', currency: 'USD', items: [{ name: item, qty: 1, unitPrice: price }], grandma: 'mama', memory: {} } });
    const v = (r.verdicts || [])[0] || {};
    const line = v.line || r.line || 'Noted.';
    return answer(`${line}${v.sub ? ` ${v.sub}` : ''}`, { kind: 'verdict', item, price, label: v.label || 'ask', line, sub: v.sub || '', left: Math.round(r.week?.left || 0), envelope: Math.round(r.week?.budget || 0), locked: false });
  });

  registerAppTool(mcp, 'shelf_items', {
    title: 'What is on the shelf',
    description: 'Use when the user asks what they put back, what they kept, or what is on their shelf. Returns the put-back items with amount, store and day, newest first.',
    inputSchema: {},
    outputSchema: { kind: z.literal('shelf'), items: z.array(z.object({ item: z.string(), amount: z.number(), store: z.string().nullable(), date: z.string(), still: z.boolean() })), total: z.number(), line: z.string() },
    ...common,
  }, async (_args, extra) => {
    const token = tokenFor(subjectOf(extra));
    const r = await api('/shelf', { token });
    const items = (r.shelf || []).slice(0, 8);
    const total = items.reduce((s, i) => s + i.amount, 0);
    const line = items.length ? `${items.length} thing${items.length === 1 ? '' : 's'} on the shelf, ${money(total)} kept.` : 'Nothing on the shelf yet.';
    return answer(items.length ? `${line} ${items.map((i) => `${i.item} ${money(i.amount)}`).join(', ')}.` : line, { kind: 'shelf', items, total: Math.round(total), line });
  });

  return mcp;
}

export function listen(port = PORT) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, api: API })); }
    if (url.pathname === '/.well-known/oauth-protected-resource') {
      // Declared so ChatGPT can discover linking once the API has an authorization server; today every tool also accepts noauth.
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ resource: process.env.MAMA_CHATGPT_URL || `http://localhost:${port}`, authorization_servers: process.env.MAMA_AUTH_SERVER ? [process.env.MAMA_AUTH_SERVER] : [], scopes_supported: ['budget:read'] }));
    }
    if (url.pathname === '/mcp') {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const mcp = buildServer();
      await mcp.connect(transport);
      res.on('close', () => { transport.close(); mcp.close(); });
      return transport.handleRequest(req, res);
    }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  listen().then((s) => console.log(`Mama's ChatGPT app is listening on http://localhost:${s.address().port}/mcp, calling ${API}`));
}
