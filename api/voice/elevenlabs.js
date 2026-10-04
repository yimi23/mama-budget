// Her voice. ElevenLabs text to speech. Returns a data URL the extension can play.
// Two voices from the ElevenLabs library, Praise's picks: ELEVEN_VOICE_ID is Mama (Amarachi, mid age
// Nigerian), ELEVEN_VOICE_ID_NANA is Nana (Mother, US Midwest). Nana falls back to Mama's id if hers is unset.
// No key: returns null and the card shows the line as text. Demo still works.

const SETTINGS = {
  mama: { stability: 0.5, similarity_boost: 0.8, style: 0.4, speed: 0.94 },
  nana: { stability: 0.6, similarity_boost: 0.8, style: 0.3, speed: 0.97 },
};

async function speak(line, who = 'mama') {
  const key = process.env.ELEVEN_API_KEY;
  const voice = who === 'nana' ? (process.env.ELEVEN_VOICE_ID_NANA || process.env.ELEVEN_VOICE_ID) : process.env.ELEVEN_VOICE_ID;
  if (!key || !voice || !line) return null;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    // Two women, two paces (Praise, Oct 4: 0.9 made Nana sound nonchalant). Mama a touch slower with more expression,
    // warm first, loud second. Nana near natural speed and steadier: dry, says less than she means. speed is 0.7 to 1.2.
    body: JSON.stringify({ text: line, model_id: 'eleven_multilingual_v2', voice_settings: SETTINGS[who] || SETTINGS.mama }),
  });
  if (!r.ok) throw new Error(`elevenlabs ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString('base64')}`;
}

module.exports = { speak };
