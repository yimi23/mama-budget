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
let liveNow = false; // true once Spectrum has actually accepted the credentials

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
      liveNow = true;
      return { app, im: imessage(app) };
    })().catch((e) => {
      console.log('[photon] connect failed:', e.message); // never the credentials themselves
      liveNow = false;
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
// A turn is everything one person sends within DEBOUNCE_MS: a screenshot and its caption arrive as two messages and
// must be read as one. Photos come as attachments (image/*), read into memory once. onIncoming(text, fromId,
// messageId, { images }) returns { reply, react } or a string; a react is a tapback on their message (a thumbs up
// when a want fits, no words), the reply is a threaded reply when there was a photo, a plain bubble otherwise.
// She types while she thinks, so a slow read never looks like silence.
const DEBOUNCE_MS = Number(process.env.PHOTON_DEBOUNCE_MS || 5000);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const turns = new Map(); // space.id -> { timer, texts, images, last, fromId }

// On a Mac, sips makes a 1200px JPEG out of a 4 MB phone screenshot in well under a second. Anywhere else, or on any
// error, the original goes as is.
function shrink(buf, mediaType) {
  if (process.platform !== 'darwin' || buf.length < 300 * 1024) return null;
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const ext = mediaType === 'image/png' ? 'png' : mediaType === 'image/webp' ? 'webp' : mediaType === 'image/gif' ? 'gif' : 'jpg';
  const src = path.join(os.tmpdir(), `mama-${process.pid}-${Date.now()}.${ext}`);
  const out = src.replace(/\.[a-z]+$/, '.small.jpg');
  try {
    fs.writeFileSync(src, buf);
    execFileSync('sips', ['-Z', '1200', '-s', 'format', 'jpeg', '-s', 'formatOptions', '75', src, '--out', out], { stdio: 'ignore', timeout: 5000 });
    return { data: fs.readFileSync(out).toString('base64'), mediaType: 'image/jpeg' };
  } catch {
    return null;
  } finally {
    for (const f of [src, out]) try { fs.unlinkSync(f); } catch { /* gone */ }
  }
}

async function imageOf(content) {
  if (content?.type !== 'attachment' || !/^image\//i.test(content.mimeType || '')) return null;
  try {
    const buf = await content.read();
    if (!buf || buf.length > MAX_IMAGE_BYTES) return null;
    const mediaType = /jpe?g/i.test(content.mimeType) ? 'image/jpeg' : /png/i.test(content.mimeType) ? 'image/png' : /webp/i.test(content.mimeType) ? 'image/webp' : /gif/i.test(content.mimeType) ? 'image/gif' : null;
    if (!mediaType) return null;
    const small = shrink(Buffer.from(buf), mediaType);
    return small || { data: Buffer.from(buf).toString('base64'), mediaType };
  } catch (e) {
    console.log('[photon] could not read attachment:', e.message);
    return null;
  }
}

function listen(onIncoming) {
  getApp().then((ctx) => {
    if (!ctx) return;
    let builders = {};
    try { builders = require('spectrum-ts'); } catch { /* plain text only */ }
    const { typing, reaction, reply: inThread, richlink, voice: voiceMsg, Emoji } = builders;
    const EMOJI = { like: Emoji?.like || '👍', love: Emoji?.love || '❤️', laugh: Emoji?.laugh || '😂' };

    const flush = async (space) => {
      const t = turns.get(space.id);
      turns.delete(space.id);
      if (!t) return;
      const text = t.texts.join(' ').trim();
      if (!text && !t.images.length) return;
      if (typing) space.send(typing('start')).catch(() => {});
      let out;
      try { out = await onIncoming(text, t.fromId, t.last.id, { images: t.images }); } catch (e) { console.log('[photon] onIncoming failed:', e.message); return; }
      if (typing) space.send(typing('stop')).catch(() => {});
      const res = typeof out === 'string' ? { reply: out } : out || {};
      if (res.react && reaction) await space.send(reaction(EMOJI[res.react] || EMOJI.like, t.last)).catch((e) => console.log('[photon] tapback failed:', e.message));
      if (res.reply) {
        const content = t.images.length && inThread ? inThread(res.reply, t.last) : res.reply;
        await space.send(content).catch((e) => console.log('[photon] reply send failed:', e.message));
      }
      if (res.voiceLine && voiceMsg) {
        const v = await res.voiceLine().catch(() => null);
        if (v && v.buffer) await space.send(voiceMsg(v.buffer, { mimeType: v.mimeType, name: v.mimeType === 'audio/mp4' ? 'mama.m4a' : 'mama.mp3' })).catch((e) => console.log('[photon] voice note failed:', e.message));
      }
      // The cheaper option, when there is one: its own bubble after the verdict, then the link so iMessage unfurls it.
      if (res.followUp) {
        if (typing) space.send(typing('start')).catch(() => {});
        const f = await res.followUp().catch(() => null);
        if (typing) space.send(typing('stop')).catch(() => {});
        if (f) {
          await space.send(f.text).catch(() => {});
          await space.send(richlink ? richlink(f.url) : f.url).catch(() => space.send(f.url).catch(() => {}));
          require('../notify/log').push({ to: t.fromId || 'them', text: `${f.text}\n${f.url}`, mood: res.mood, sender: 'photon', sent: true, direction: 'out', at: Date.now() });
        }
      }
    };

    (async () => {
      for await (const [space, message] of ctx.app.messages) {
        const fromId = message.sender?.id;
        if (fromId) spaces.remember(fromId, space.id);
        const c = message.content;
        const image = await imageOf(c);
        const text = c?.type === 'text' ? c.text : c?.type === 'markdown' ? c.markdown : '';
        if (!image && !text) continue;
        const t = turns.get(space.id) || { texts: [], images: [], fromId, last: message };
        if (text) t.texts.push(text);
        if (image) t.images.push(image);
        t.last = message;
        t.fromId = fromId || t.fromId;
        if (t.timer) clearTimeout(t.timer);
        t.timer = setTimeout(() => flush(space).catch((e) => console.log('[photon] turn failed:', e.message)), DEBOUNCE_MS);
        turns.set(space.id, t);
      }
    })().catch((e) => console.log('[photon] listener stopped:', e.message));
  }).catch(() => {});
}

/** Keys set AND accepted by the cloud. Bad keys must not silence her: the Mac kit or the log takes over. */
function live() { return liveNow; }

module.exports = { send, listen, credentials, connected, live };
