// Minimal .env loader, no new dependency (see CLAUDE.md: "No new dependencies without a reason").
// docs/NESSIE.md says apps/api/.env, but there is no apps/api directory in this repo and nothing
// here ever called a .env loader -- NESSIE_KEY only worked if it was exported in the shell before
// `node api/server.js` / `node api/nessie/seed.js`. This loads api/.env (already in .gitignore)
// into process.env, without overwriting any var the shell already set.
const fs = require('node:fs');
const path = require('node:path');

function loadEnv() {
  let text;
  try { text = fs.readFileSync(path.join(__dirname, '.env'), 'utf8'); } catch { return; }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();
module.exports = { loadEnv };
