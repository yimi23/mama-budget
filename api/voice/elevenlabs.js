// Her voice. ElevenLabs text to speech. Returns a data URL the extension can play.
// Two voices from the ElevenLabs library, Praise's picks: ELEVEN_VOICE_ID is Mama (Amarachi, mid age
// Nigerian), ELEVEN_VOICE_ID_NANA is Nana (Mother, US Midwest). Nana falls back to Mama's id if hers is unset.
// No key: returns null and the card shows the line as text. Demo still works.

const SETTINGS = {
  mama: { stability: 0.5, similarity_boost: 0.8, style: 0.4, speed: 0.94 },
  nana: { stability: 0.6, similarity_boost: 0.8, style: 0.3, speed: 0.97 },
};

// Shocked and Gele down get more expression and a touch more speed; a nod or an ask stays level.
const LOUD = { shocked: { style: +0.25, stability: -0.15, speed: +0.04 }, down: { style: +0.2, stability: -0.1, speed: +0.02 } };
function settingsFor(who, mood) {
  const base = SETTINGS[who] || SETTINGS.mama;
  const d = LOUD[mood];
  if (!d) return base;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return { ...base, style: clamp(base.style + d.style, 0, 1), stability: clamp(base.stability + d.stability, 0, 1), speed: clamp(base.speed + d.speed, 0.7, 1.2) };
}

async function speak(line, who = 'mama', mood = 'calm') {
  const key = process.env.ELEVEN_API_KEY;
  const voice = who === 'nana' ? (process.env.ELEVEN_VOICE_ID_NANA || process.env.ELEVEN_VOICE_ID) : process.env.ELEVEN_VOICE_ID;
  if (!key || !voice || !line) return null;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    // Two women, two paces (Praise, Oct 4: 0.9 made Nana sound nonchalant). Mama a touch slower with more expression,
    // warm first, loud second. Nana near natural speed and steadier: dry, says less than she means. speed is 0.7 to 1.2.
    body: JSON.stringify({ text: line, model_id: 'eleven_multilingual_v2', voice_settings: settingsFor(who, mood) }),
  });
  if (!r.ok) throw new Error(`elevenlabs ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString('base64')}`;
}

module.exports = { speak };
