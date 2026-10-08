// The house icons (design/house-icons), as DOM nodes. Two strokes per glyph: the body in currentColor and the accent
// stroke, which follows --ytech-accent and is set to the gele green when the control acts. Built with createElementNS
// so no markup string ever touches innerHTML. Only the icons the extension uses are here; the full set is in public/icons.

export type IconName = 'close' | 'voice' | 'voiceOff' | 'go' | 'external' | 'check';

const PATHS: Record<IconName, { body: string[]; accent: string[] }> = {
  close: { body: ['M6 6L18 18'], accent: ['M18 6L6 18'] },
  voice: { body: ['M4 10.5V13.5M8 8V16M16 8V16M20 10.5V13.5'], accent: ['M12 4.5V19.5'] },
  voiceOff: { body: ['M4 10.5V13.5M8 8V16M16 8V16M20 10.5V13.5', 'M12 4.5V19.5'], accent: ['M3 21L21 3'] },
  go: { body: ['M9 6L15 12L9 18'], accent: [] },
  external: { body: ['M14 4H20V10', 'M20 4L11 13', 'M18 14V19A1 1 0 0 1 17 20H5A1 1 0 0 1 4 19V7A1 1 0 0 1 5 6H10'], accent: [] },
  check: { body: ['M5 12.5L9.5 17L19 7'], accent: [] },
};

const NS = 'http://www.w3.org/2000/svg';

/** An inline SVG icon, 24 unit grid, sized by CSS. `accent` paints the accent stroke; otherwise it follows the body. */
export function icon(name: IconName, size = 18): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const spec = PATHS[name];
  for (const [d, accent] of [...spec.body.map((d) => [d, false] as const), ...spec.accent.map((d) => [d, true] as const)]) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', accent ? 'var(--ytech-accent, currentColor)' : 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
  }
  return svg;
}
