// Writes the face SVGs from design/*_faces.json into public/faces/<grandma>/<mood>.svg.
// Run after the design JSON changes: node scripts/faces.mjs
import fs from 'node:fs';

// Her eyes are white ellipses; a skin coloured lid is laid over each and drops every 7.3s. Calm wears shades, so
// only faces with open eyes blink. Nana is static art (BUILD_PLAN cut lines), so she gets no lids.
const SKIN = { mama: '#6E3D24' };
const BLINK_CSS = '<style>@keyframes mb-blink{0%,91%{transform:scaleY(0)}93.5%,95.5%{transform:scaleY(1)}98%,100%{transform:scaleY(0)}}'
  + '.mb-lid{transform-box:fill-box;transform-origin:50% 0%;transform:scaleY(0);animation:mb-blink 7.3s linear infinite}'
  + '@media(prefers-reduced-motion:reduce){.mb-lid{animation:none}}</style>';

function withBlink(svg, grandma) {
  const skin = SKIN[grandma];
  if (!skin) return svg;
  const eyes = [...svg.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)" fill="#FFFFFF"><\/ellipse>/g)];
  if (eyes.length < 2) return svg;
  const lids = eyes.map(([, cx, cy, rx, ry]) =>
    `<ellipse class="mb-lid" cx="${cx}" cy="${cy}" rx="${+rx + 1.5}" ry="${+ry + 1.5}" fill="${skin}"></ellipse>`).join('');
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
