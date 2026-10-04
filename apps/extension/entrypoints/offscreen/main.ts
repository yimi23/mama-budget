// The offscreen document: the one place audio plays from. The extension origin is not subject to a store's autoplay
// policy, and nothing on the store page can hear or stop it. Plays one voice line at a time; a new line replaces the
// last. The six cue sounds are synthesised here with Web Audio, so there are no files to ship and each is exactly as
// long as the plan says: arrive 1.2s, ask 0.6s, surprised 0.4s, proud 0.9s, text 0.5s, tick 0.4s. No music.

import type { Cue } from '@mama/shared/types';

let current: HTMLAudioElement | undefined;
let ctx: AudioContext | undefined;

// A sine note with a soft attack and a longer release, so nothing clicks. Frequencies in Hz, times in seconds.
function note(ac: AudioContext, at: number, freq: number, length: number, gain: number, glideTo?: number) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + length * 0.8);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(ac.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5;

function playCue(cue: Cue, volume: number): number {
  ctx ??= new AudioContext();
  const ac = ctx;
  if (ac.state === 'suspended') void ac.resume();
  const t = ac.currentTime + 0.01;
  const v = Math.max(0, Math.min(1, volume)) * 0.35;
  switch (cue) {
    case 'arrive': note(ac, t, C5, 0.7, v, G5); note(ac, t + 0.45, G5, 0.75, v * 0.8); return 1.2;
    case 'ask': note(ac, t, E5, 0.6, v, A5); return 0.6;
    case 'surprised': note(ac, t, A5, 0.18, v); note(ac, t + 0.16, C6, 0.24, v); return 0.4;
    case 'proud': note(ac, t, C5, 0.35, v); note(ac, t + 0.25, E5, 0.35, v); note(ac, t + 0.5, G5, 0.4, v); return 0.9;
    case 'text': note(ac, t, G5, 0.2, v * 0.9); note(ac, t + 0.22, C6, 0.28, v * 0.9); return 0.5;
    case 'tick': note(ac, t, A5, 0.4, v * 0.7); return 0.4;
  }
}

browser.runtime.onMessage.addListener((msg: { type?: string; dataUrl?: string; volume?: number; gain?: number; cue?: Cue }, _sender, sendResponse) => {
  if (msg?.type === 'PLAY_CUE' && msg.cue) {
    try { sendResponse({ ok: true, duration: playCue(msg.cue, msg.volume ?? 0.8) }); } catch { sendResponse({ ok: false }); }
    return false;
  }
  if (msg?.type !== 'PLAY' || !msg.dataUrl) return false;
  current?.pause();
  const audio = new Audio(msg.dataUrl);
  const volume = Math.max(0, Math.min(1, msg.volume ?? 0.8));
  const gain = Math.max(0.5, Math.min(2, msg.gain ?? 1));
  // An element's volume stops at 1. A grandma whose voice renders quiet goes through a gain node instead.
  if (gain > 1) {
    try {
      ctx ??= new AudioContext();
      const src = ctx.createMediaElementSource(audio);
      const g = ctx.createGain();
      g.gain.value = volume * gain;
      src.connect(g).connect(ctx.destination);
      audio.volume = 1;
    } catch {
      audio.volume = volume;
    }
  } else {
    audio.volume = volume * gain;
  }
  current = audio;
  // The reply carries the clip length so a screen can show "Speaking" for exactly as long as she speaks.
  audio.play().then(
    () => sendResponse({ ok: true, duration: Number.isFinite(audio.duration) ? audio.duration : null }),
    () => sendResponse({ ok: false, duration: null }),
  );
  return true;
});
