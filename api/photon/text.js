// Mama texts you. Photon iMessage kit. Runs on a Mac signed into Messages with a spare Apple ID.
// Install on that Mac: npm i @photon-hq/imessage-kit  (check the exact package name in Photon's docs)
// Set PHOTON_TO to the judge's number right before the demo. Only iPhones get the text.
// No config: this is a no op and the demo carries on without the text.

async function text(line) {
  const to = process.env.PHOTON_TO;
  if (!to || !line) return null;
  let kit;
  try { kit = require('@photon-hq/imessage-kit'); } catch { return null; }
  const client = new kit.IMessageClient();
  await client.send(to, line);
  return { to, line };
}

module.exports = { text };
