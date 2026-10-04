// The offscreen document: the one place audio plays from. The extension origin is not subject to a store's autoplay
// policy, and nothing on the store page can hear or stop it. Plays one thing at a time; a new line replaces the last.

let current: HTMLAudioElement | undefined;

browser.runtime.onMessage.addListener((msg: { type?: string; dataUrl?: string; volume?: number }, _sender, sendResponse) => {
  if (msg?.type !== 'PLAY' || !msg.dataUrl) return false;
  current?.pause();
  const audio = new Audio(msg.dataUrl);
  audio.volume = Math.max(0, Math.min(1, msg.volume ?? 0.8));
  current = audio;
  audio.play().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
  return true;
});
