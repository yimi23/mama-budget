// Writes the face SVGs from design/*_faces.json into public/faces/<grandma>/<mood>.svg.
// Run after the design JSON changes: node scripts/faces.mjs
import fs from 'node:fs';

// Her eyes are white ellipses; a skin coloured lid is laid over each and drops every 7.3s. Calm wears shades, so
// only faces with open eyes blink. Nana is static art (BUILD_PLAN cut lines), so she gets no lids.
const SKIN = { mama: '#6E3D24' };
const BLINK_CSS = '<style>@keyframes mb-blink{0%,94%{transform:scaleY(0)}95.2%,96.2%{transform:scaleY(1)}97.7%,100%{transform:scaleY(0)}}'
  + '.mb-lid{transform-box:fill-box;transform-origin:50% 0%;transform:scaleY(0);animation:mb-blink 7.3s linear infinite}'
  + '@media(prefers-reduced-motion:reduce){.mb-lid{animation:none}}</style>';

function withBlink(svg, grandma) {
  const skin = SKIN[grandma];
  if (!skin) return svg;
  const eyes = [...svg.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)" fill="#FFFFFF"><\/ellipse>/g)];
  if (eyes.length < 2) return svg;
  // Each lid is a skin oval with a lash line along its lower edge. Scaled from the top, the line travels down and
  // sits at the bottom of the eye when shut, which is how a closed eye is drawn. A bare oval reads as a glint.
  const lids = eyes.map(([, cx, cy, rx, ry]) => {
    const [x, y, w, h] = [+cx, +cy, +rx + 1.5, +ry + 1.5];
    return `<g class="mb-lid"><ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="${skin}"></ellipse>`
      + `<path d="M${x - w * 0.85} ${y + h * 0.55} Q${x} ${y + h * 1.05} ${x + w * 0.85} ${y + h * 0.55}" stroke="#1E1A2E" stroke-width="2.6" stroke-linecap="round" fill="none"></path></g>`;
  }).join('');
  return svg.replace('</svg>', `${BLINK_CSS}${lids}</svg>`);
}

for (const grandma of ['mama', 'nana']) {
  const faces = JSON.parse(fs.readFileSync(new URL(`../../../design/${grandma}_faces.json`, import.meta.url), 'utf8'));
  const dir = new URL(`../public/faces/${grandma}/`, import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  for (const [mood, svg] of Object.entries(faces)) {
    // Standalone files need the namespace; inline markup in the screens did not.
    const file = svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    fs.writeFileSync(new URL(`${mood}.svg`, dir), withBlink(file, grandma));
  }
  console.log(grandma, Object.keys(faces).join(' '));
}
