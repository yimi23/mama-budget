// Quiet hours: 11pm to 7am local. Badge state only; no voice, no cue sounds (CLAUDE.md product rules).
// Pure, so tests run it in plain node. The Messages side has the same rule in api/photon/gate.js.

export function quietHours(now: Date = new Date()): boolean {
  const h = now.getHours();
  return h >= 23 || h < 7;
}
