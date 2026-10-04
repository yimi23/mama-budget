// The Messages routes, kept out of server.js so the pipe and the extension share one surface.
//   POST /inbound          { id, from, chatId?, text }   -> her reply, sent to the sender, { reply, action, texted, week }
//   GET  /schedule         what is due, when the next statements go, last sent
//   GET  /schedule?now=1   send the weekly statement now (onboarding 07, the demo); ?grandma=nana remembers who texts
//   POST /schedule         { now: true, grandma?, kind?, to? } same, for callers that would rather post
//   GET  /photon/health    { configured, kit, db, ready, quiet, lastError }: can she text right now
const { handleInbound } = require('./inbound');
const schedule = require('./schedule');
const { status } = require('./text');

async function scheduleRoute(body = {}, query = {}) {
  const q = { ...query, ...body };
  const now = q.now === 1 || q.now === '1' || q.now === true || q.now === 'true';
  if (!now) return schedule.overview();
  const out = await schedule.send(q.kind === 'monthly' ? 'monthly' : 'weekly', { to: q.to || undefined, grandma: q.grandma });
  // Not sent is not an error: the popup reads ok=false and shows "Texts are off right now". Never a fake sent state.
  return out.ok ? out : { ...out, reason: (await status()).reason || 'texts are off right now' };
}

const routes = {
  'POST /inbound': (body) => handleInbound(body),
  'GET /schedule': (body, query) => scheduleRoute({}, query),
  'POST /schedule': (body) => scheduleRoute(body),
  'GET /photon/health': () => status(),
};

module.exports = { routes, startScheduler: schedule.startScheduler };
