// GET /bank: a plain page standing in for a real card swipe, so the watcher (notify/watch.js) has
// something to notice without needing the extension or curl. Auto-refreshes; no client JS framework.

const CSS = `
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; background: #f4f5f7; color: #1f2430; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .card { background: #fff; border: 1px solid #e3e5ea; border-radius: 10px; padding: 16px; }
  .card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 0 0 8px; }
  .bar-track { background: #e9eaee; border-radius: 6px; height: 10px; overflow: hidden; margin-top: 10px; }
  .bar-fill { height: 100%; background: #3b7cf6; }
  .bar-fill.over { background: #e0533d; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  button { background: #1f2430; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
  button:hover { background: #333a4a; }
  button.reset { background: #a1372b; }
  button.reset:hover { background: #c04435; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th { color: #6b7280; font-weight: 500; }
  .label { padding: 2px 8px; border-radius: 10px; font-size: 11px; }
  .label.need { background: #e4f3e8; color: #1e7b3c; }
  .label.want { background: #fdeee0; color: #a85c1a; }
  .label.family, .label.saved { background: #eaf0fd; color: #2b4ea8; }
  .msg { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px; }
  .msg .meta { color: #6b7280; font-size: 11px; }
  .msg.in { color: #2b4ea8; }
`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page({ week, purchases, messages }) {
  const pct = Math.min(Math.max(week.ratio || 0, 0), 1) * 100;
  const over = (week.ratio || 0) > 1 ? ' over' : '';

  const rows = purchases.slice().reverse().slice(0, 15).map((p) => `
    <tr><td>${escapeHtml(p.date)}</td><td>${escapeHtml(p.item)}</td><td>${escapeHtml(p.merchant || '')}</td>
    <td>$${Number(p.amount).toFixed(2)}</td><td><span class="label ${p.tag}">${p.tag}</span></td></tr>`).join('') ||
    '<tr><td colspan="5">No purchases yet</td></tr>';

  const msgRows = messages.slice().reverse().slice(0, 12).map((m) => `
    <div class="msg ${m.direction}">
      <div class="meta">${new Date(m.at).toLocaleTimeString()} &middot; ${m.direction === 'in' ? 'them' : `to ${escapeHtml(m.to)}`} &middot; ${m.mood || ''} ${m.sender ? `(${m.sender}${m.sent ? ', sent' : ''})` : ''}</div>
      <div>${escapeHtml(m.text).replace(/\n/g, '<br>')}</div>
    </div>`).join('') || '<div class="msg">Nothing yet.</div>';

  const body = `
<h1>Demo card terminal</h1>
<p class="sub">Stands in for a real card swipe.</p>
<div class="grid">
  <div class="card">
    <h2>This week's budget</h2>
    <div>$${week.spent} of $${week.budget} gone (${Math.round(pct)}%). $${week.left} left.</div>
    <div class="bar-track"><div class="bar-fill${over}" style="width:${pct}%"></div></div>
    <div class="buttons">
      <button onclick="charge('airpods')">AirPods Pro $179 (want)</button>
      <button onclick="charge('groceries')">Groceries $28 (need)</button>
      <button onclick="charge('latte')">Latte $7 (want)</button>
      <button onclick="chargeLastCart()">Charge last cart</button>
      <button class="reset" onclick="resetDemo()">Reset</button>
    </div>
  </div>
  <div class="card">
    <h2>Latest messages</h2>
    ${msgRows}
  </div>
</div>
<div class="card">
  <h2>Checking &mdash; recent purchases</h2>
  <table>
    <tr><th>Date</th><th>Item</th><th>Merchant</th><th>Amount</th><th>Tag</th></tr>
    ${rows}
  </table>
</div>
`;

  const script = `
function charge(preset) { fetch('/bank/charge', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ preset }) }).then(() => location.reload()); }
function chargeLastCart() { fetch('/bank/charge-last-cart', { method: 'POST' }).then(() => location.reload()); }
function resetDemo() { fetch('/reset', { method: 'POST' }).then(() => location.reload()); }
`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="3">` +
    `<title>Demo card terminal</title><style>${CSS}</style></head><body>${body}<script>${script}</script></body></html>`;
}

module.exports = { page };
