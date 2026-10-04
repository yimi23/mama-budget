// Writes the face SVGs from design/*_faces.json into public/faces/<grandma>/<mood>.svg.
// Run after the design JSON changes: node scripts/faces.mjs
import fs from 'node:fs';

for (const grandma of ['mama', 'nana']) {
  const faces = JSON.parse(fs.readFileSync(new URL(`../../../design/${grandma}_faces.json`, import.meta.url), 'utf8'));
  const dir = new URL(`../public/faces/${grandma}/`, import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  for (const [mood, svg] of Object.entries(faces)) {
    // Standalone files need the namespace; inline markup in the screens did not.
    const file = svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    fs.writeFileSync(new URL(`${mood}.svg`, dir), file);
  }
  console.log(grandma, Object.keys(faces).join(' '));
}
