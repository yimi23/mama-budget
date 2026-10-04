// Sender two: Photon's cloud iMessage, via spectrum-ts. Used only when SPECTRUM_PROJECT_ID and
// SPECTRUM_PROJECT_SECRET are set in api/.env (Photon's own names; PHOTON_PROJECT_ID/SECRET are
// read as a fallback for anyone who set those instead). Otherwise every function here is a no-op,
// so the demo runs fine on the "log" sender alone with nothing configured.
//
// What the docs say (read in full before the demo):
//   https://photon.codes/docs/spectrum-ts/getting-started
//   https://photon.codes/docs/spectrum-ts/providers/imessage
//
// - No Mac required for this provider. spectrum-ts ships TWO iMessage providers: the cloud one
//   (@spectrum-ts/imessage, what this file uses) authenticates to Spectrum Cloud over gRPC and runs
//   anywhere Node runs. The OTHER one (@spectrum-ts/imessage-local) is Mac-only -- it reads
//   ~/Library/Messages/chat.db directly and needs a Mac signed into Messages with Full Disk Access.
//   We want the cloud one specifically because this box is not a Mac.
// - Sign up at https://app.photon.codes/, create a project, and its Settings page has PROJECT_ID
//   and SECRET_KEY. That's the whole signup: no phone, no Apple ID.
// - First message to someone who has never texted in: narrow to the iMessage platform, resolve the
//   phone number to a user, create a space, then send on it. Verified against the installed
//   package's own .d.ts (node_modules/@spectrum-ts/core and @spectrum-ts/imessage), which match the
//   dashboard's echo sample exactly:
//     Spectrum({ projectId, projectSecret, providers: [imessage.config()] }) -> { messages, ... }
//     imessage(app) -> { user(id), space: { create(users), get(id) }, messages }
//     a Space has .id and .send(content); a Message has .content, .sender.id, .space
//   space.get(id) is how a previously-remembered space (notify/spaces.js) is reused instead of
//   starting a new conversation every time.

let appPromise;

function credentials() {
  const projectId = process.env.SPECTRUM_PROJECT_ID || process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET || process.env.PHOTON_PROJECT_SECRET;
  return projectId && projectSecret ? { projectId, projectSecret } : null;
}

async function getApp() {
  const creds = credentials();
  if (!creds) return null;
  if (!appPromise) {
    appPromise = (async () => {
      let Spectrum, imessage;
      try {
        ({ Spectrum } = require('spectrum-ts'));
        ({ imessage } = require('spectrum-ts/providers/imessage'));
      } catch {
        return null; // package not installed: skip this sender without errors
      }
      const app = await Spectrum({ projectId: creds.projectId, projectSecret: creds.projectSecret, providers: [imessage.config()] });
      return { app, im: imessage(app) };
    })().catch((e) => {
      console.log('[photon] connect failed:', e.message); // never the credentials themselves
      return null;
    });
  }
  return appPromise;
}

/** True once a connection has actually been established (used to confirm startup without secrets). */
async function connected() {
  return (await getApp()) !== null;
}

const spaces = require('../notify/spaces');

/** Sends `text` to `to` (a phone number), reusing a remembered space if we have one for them. */
async function send(to, text) {
  if (!to || !text) return null;
  const ctx = await getApp();
  if (!ctx) return null;
  try {
    const knownSpaceId = spaces.get(to);
    const space = knownSpaceId ? await ctx.im.space.get(knownSpaceId) : await ctx.im.space.create(await ctx.im.user(to));
    await space.send(text);
    spaces.remember(to, space.id);
    return { to, text };
  } catch (e) {
    console.log('[photon] send failed:', e.message);
    return null;
  }
}

// Listens for every inbound text and asks onIncoming(text, fromId) what to say back. Remembers the
// sender's space on every message, so a later proactive text (the bank watcher notifying them) reuses
// the same conversation instead of starting a new one. Replies on the same space it arrived on --
// the correct way to continue a thread; a fresh send() would start a second conversation instead.
// A no-op when credentials or the package are missing, so wiring this up unconditionally is safe.
function listen(onIncoming) {
  getApp().then((ctx) => {
    if (!ctx) return;
    (async () => {
      for await (const [space, message] of ctx.app.messages) {
        if (message.content?.type !== 'text') continue;
        const fromId = message.sender?.id;
        if (fromId) spaces.remember(fromId, space.id);
        let reply;
        try { reply = await onIncoming(message.content.text, fromId); } catch (e) { console.log('[photon] onIncoming failed:', e.message); continue; }
        if (reply) await space.send(reply).catch((e) => console.log('[photon] reply send failed:', e.message));
      }
    })().catch((e) => console.log('[photon] listener stopped:', e.message));
  }).catch(() => {});
}

module.exports = { send, listen, credentials, connected };
