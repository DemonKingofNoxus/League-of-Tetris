/* Generates neutral placeholder art so the game looks finished before real
   assets exist. Every file here is meant to be overwritten. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'assets');

const wrap = (body) =>
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
${body}
</svg>
`;

/* ---- region crests: white glyphs, drawn inset on the region's colour ---- */
/*
 * These render at roughly 22-26 physical pixels, so only the silhouette
 * survives. Everything is a bold filled shape or a very thick stroke —
 * thin line art turns into an unreadable blob at this size.
 */
const W = 'fill="#fff" fill-opacity="0.92"';
const S = 'fill="none" stroke="#fff" stroke-opacity="0.92" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"';

const regions = {
  // Demacia — shield
  demacia: `<path ${W} d="M50 6 88 20v32c0 24-17 37-38 44C29 89 12 76 12 52V20z"/>
<path fill="#000" fill-opacity="0.34" d="M50 26l11 22-11 28-11-28z"/>`,
  // Noxus — bladed star
  noxus: `<path ${W} d="M50 3l13 28 29 9-22 20 7 34-27-16-27 16 7-34-22-20 29-9z"/>`,
  // Ionia — single leaf
  ionia: `<path ${W} d="M50 6c26 20 26 52 0 76-26-24-26-56 0-76z"/>
<path fill="#000" fill-opacity="0.34" d="M46 30h8v56h-8z"/>`,
  // Freljord — snowflake
  freljord: `<g ${S}><path d="M50 8v84"/><path d="M13 29l74 42"/><path d="M87 29L13 71"/></g>
<path ${W} d="M50 26l-16-16h32zM50 74l-16 16h32z"/>`,
  // Zaun — hazard cog
  zaun: `<path ${W} d="M42 2h16l3 14 13 6 13-8 11 11-8 13 6 13 14 3v16l-14 3-6 13 8 13-11 11-13-8-13 6-3 14H42l-3-14-13-6-13 8-11-11 8-13-6-13-14-3V54l14-3 6-13-8-13 11-11 13 8 13-6z"/>
<circle cx="50" cy="50" r="15" fill="#000" fill-opacity="0.34"/>`,
  // Bilgewater — anchor
  bilgewater: `<g ${S}><path d="M50 24v62"/><path d="M24 44h52"/>
<path d="M16 60c0 20 15 30 34 30s34-10 34-30"/></g>
<circle cx="50" cy="14" r="13" ${W}/><circle cx="50" cy="14" r="5" fill="#000" fill-opacity="0.34"/>`
};

/* ---- champion placeholders: dark disc + initials, full-tile ---- */
const champs = {
  'darius':       ['DA', '#8e2a24'],
  'lux':          ['LU', '#a8894a'],
  'ziggs':        ['ZI', '#4d8a34'],
  'ashe':         ['AS', '#3f7f9c'],
  'yasuo':        ['YA', '#9c568a'],
  'miss-fortune': ['MF', '#9c5620']
};

function champSvg(initials, tint) {
  return wrap(
`<circle cx="50" cy="50" r="42" fill="${tint}" stroke="#fff" stroke-opacity="0.85" stroke-width="5"/>
<text x="50" y="50" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui, sans-serif" font-size="34" font-weight="700"
      fill="#fff" fill-opacity="0.95">${initials}</text>`);
}

fs.mkdirSync(path.join(ROOT, 'regions'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'champions'), { recursive: true });

Object.keys(regions).forEach((k) => {
  fs.writeFileSync(path.join(ROOT, 'regions', k + '.svg'), wrap(regions[k]));
});

Object.keys(champs).forEach((k) => {
  fs.writeFileSync(path.join(ROOT, 'champions', k + '.svg'), champSvg(champs[k][0], champs[k][1]));
});

console.log('wrote', Object.keys(regions).length, 'region crests and', Object.keys(champs).length, 'champion placeholders');
