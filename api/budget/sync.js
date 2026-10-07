// SimpleFIN: the bank, read only. A person makes a Setup Token on the Bridge and pastes it into Mama; we claim it once
// for an Access URL (credentials baked in), then GET /accounts from it. Nothing here writes to a bank, and no bank
// login ever reaches us. Shapes below are from a live version-2 response recorded Oct 5 2026
// (api/test/fixtures/simplefin-demo-v2.json): transactions carry payee, memo and an mcc code, which the protocol page
// does not promise, so every field is read defensively.
//
// Limits the Bridge states: about daily refresh, 24 requests a day per Access URL, 90 days per request (45 recommended), and the
// errlist must be shown to the person. A window overlaps the previous one by 5 days because posted rows change.

const DAY = 86400;
const WINDOW_DAYS = 45; // the Bridge allows 90 but recommends 45 and says it may cap there
const OVERLAP_DAYS = 5;
const DAILY_CAP = 24;

/** The one-time exchange: decode the Setup Token to its claim URL and POST to it. The token is dead afterwards. */
async function claim(setupToken, fetchImpl = fetch) {
  const token = String(setupToken || '').trim();
  if (!token) throw new Error('setup token is required');
  let claimUrl;
  try { claimUrl = Buffer.from(token, 'base64').toString('utf8'); } catch { throw new Error('setup token is not base64'); }
  if (!/^https:\/\//.test(claimUrl)) throw new Error('setup token does not decode to an https URL');
  const res = await fetchImpl(claimUrl, { method: 'POST', headers: { 'content-length': '0' } });
  const text = (await res.text()).trim();
  if (!res.ok || !/^https:\/\/[^@\s]+:[^@\s]+@/.test(text)) throw new Error(`claim refused (${res.status}): ${text.slice(0, 120)}`);
  return text; // https://user:pass@host/simplefin
}

/** Split an Access URL into the base and its basic-auth header, so credentials never travel in a logged URL. */
function split(accessUrl) {
  const u = new URL(String(accessUrl));
  const auth = 'Basic ' + Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString('base64');
  u.username = ''; u.password = '';
  return { base: u.toString().replace(/\/$/, ''), auth };
}

/**
 * GET /accounts for one window. start and end are unix seconds; the Bridge caps end - start at 90 days. pending=1 asks
 * for pending rows (posted is 0 on them). Returns the raw body with errlist, accounts and connections.
 */
async function pull(accessUrl, { start, end, pending = true, balancesOnly = false, account } = {}, fetchImpl = fetch) {
  const { base, auth } = split(accessUrl);
  const q = new URLSearchParams({ version: '2' });
  if (start != null) q.set('start-date', String(Math.floor(start)));
  if (end != null) q.set('end-date', String(Math.floor(end)));
  if (pending) q.set('pending', '1');
  if (balancesOnly) q.set('balances-only', '1');
  if (account) q.set('account', String(account));
  if (start != null && end != null && end - start > WINDOW_DAYS * DAY) throw new Error(`window over ${WINDOW_DAYS} days`);
  const res = await fetchImpl(`${base}/accounts?${q}`, { headers: { authorization: auth, accept: 'application/json' } });
  if (res.status === 403) throw new Error('access url disabled (the person revoked it, or the quota was exceeded)');
  if (!res.ok) throw new Error(`simplefin ${res.status}`);
  const body = await res.json();
  return { errlist: Array.isArray(body.errlist) ? body.errlist : [], accounts: Array.isArray(body.accounts) ? body.accounts : [], connections: Array.isArray(body.connections) ? body.connections : [], messages: Array.isArray(body['x-api-message']) ? body['x-api-message'] : [] };
}

/** The windows to fetch `days` of history ending now: 90-day slices, each overlapping the next by 5 days, oldest first. */
function windows(days, now = Math.floor(Date.now() / 1000)) {
  const out = [];
  let end = now;
  let left = Math.max(1, Math.ceil(days));
  while (left > 0) {
    const span = Math.min(WINDOW_DAYS, left + OVERLAP_DAYS);
    out.push({ start: end - span * DAY, end });
    left -= WINDOW_DAYS - OVERLAP_DAYS;
    end = end - (WINDOW_DAYS - OVERLAP_DAYS) * DAY;
  }
  return out.reverse();
}

/**
 * Rows the rest of the pipeline reads. One flat list across accounts, newest first. Amounts are numbers (positive is
 * money in). Strings the Bridge may omit are empty, never undefined. `posted` 0 means pending.
 */
function rows(body) {
  const out = [];
  for (const a of body.accounts || []) {
    for (const t of a.transactions || []) {
      out.push({
        id: String(t.id), accountId: String(a.id), accountName: String(a.name || ''), connection: String(a.conn_id || ''),
        currency: String(a.currency || 'USD'), amount: Number(t.amount), posted: Number(t.posted || 0), transactedAt: Number(t.transacted_at || t.posted || 0),
        pending: !!t.pending || !Number(t.posted), description: String(t.description || ''), payee: String(t.payee || ''), memo: String(t.memo || ''), mcc: t.mcc ? String(t.mcc) : '',
      });
    }
  }
  return out.sort((x, y) => (y.posted || y.transactedAt) - (x.posted || x.transactedAt));
}

/** Accounts as the plan reads them: cash balances, with the holdings' market value kept separate. */
function accounts(body) {
  return (body.accounts || []).map((a) => ({
    id: String(a.id), name: String(a.name || ''), connection: String(a.conn_id || ''), currency: String(a.currency || 'USD'),
    balance: Number(a.balance), available: a['available-balance'] != null ? Number(a['available-balance']) : null, balanceDate: Number(a['balance-date'] || 0),
    holdingsValue: (a.holdings || []).reduce((s, h) => s + Number(h.market_value || 0), 0), transactions: (a.transactions || []).length,
  }));
}

/** A day's request budget: true when one more request stays inside the Bridge's expectation. */
function underCap(requestsToday) { return Number(requestsToday || 0) < DAILY_CAP; }

module.exports = { claim, split, pull, windows, rows, accounts, underCap, WINDOW_DAYS, OVERLAP_DAYS, DAILY_CAP };
