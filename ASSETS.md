# Art you need to provide

Every file listed here already exists as a **placeholder** so the game looks
finished right now. Overwrite them one at a time — keep the filename, and the
new art appears with no code changes. If you delete a file instead, the game
falls back to a flat coloured tile with a label and keeps working.

Paths are set in `src/config.js`. Change `.svg` to `.png` there if you prefer
PNGs; the loader accepts any format the browser can display.

---

## 1. Region crests — 6 files, **highest priority**

`assets/regions/<name>.svg`

| File | Region | Fallback colour |
| --- | --- | --- |
| `demacia.svg` | Demacia | `#d8b45a` |
| `noxus.svg` | Noxus | `#bf3b34` |
| `ionia.svg` | Ionia | `#d97ab8` |
| `freljord.svg` | Freljord | `#5fb6dd` |
| `zaun.svg` | Zaun | `#6cc24a` |
| `bilgewater.svg` | Bilgewater | `#d4772c` |

**Specs**

- Square, `viewBox="0 0 100 100"` (or a square PNG at 128×128).
- **Transparent background.** The tile already draws a coloured plate behind it.
- **Single flat colour — white.** The plate supplies the colour; a white glyph
  reads on every region.
- **Bold silhouettes only.** These render at about **26×26 physical pixels**.
  Thin lines merge into a grey smudge at that size. Keep strokes at 10+ units in
  a 100-unit viewBox, and avoid more than 2–3 separate shapes per crest.
- Test by squinting at it small. If you cannot tell it apart from the other five
  at 26px, it is too detailed.

The official region crests are quite intricate — you will likely need to
simplify them to their outer silhouette rather than use them directly.

## 2. Champion portraits — 6 files

`assets/champions/<name>.svg`

| File | Champion | Region |
| --- | --- | --- |
| `darius.svg` | Darius | Noxus |
| `lux.svg` | Lux | Demacia |
| `ziggs.svg` | Ziggs | Zaun |
| `ashe.svg` | Ashe | Freljord |
| `yasuo.svg` | Yasuo | Ionia |
| `miss-fortune.svg` | Miss Fortune | Bilgewater |

**Specs**

- Square, **128×128 PNG** is ideal here (portraits are photographic, so PNG
  beats SVG). Transparent or filled background both work — this one is drawn
  edge to edge on the tile.
- Crop **tight to the face**. Full-body or waist-up art becomes an unreadable
  smudge at 26px. Think Discord avatar, not splash art.
- High contrast, bright subject. The board is dark.
- The renderer already draws a white ring around champion tiles so players can
  tell they are clickable — you do not need to add one.

Riot's official square champion icons (the 120×120 ones used in-client) are
exactly the right crop and size. They are fine for a free fan project; they are
**not** licensed for a commercial release — see the note at the end of the
README.

## 3. Optional extras

These are not wired up yet. Tell me if you want them and I will add the code.

| What | Size | Use |
| --- | --- | --- |
| Logo / wordmark | ~600×160 PNG or SVG, transparent | Replace the text title |
| Board background | 320×640 PNG | Texture behind the grid |
| Ability icons | 64×64 PNG each | Next to champion names in the side panel |
| Sound effects | `.mp3`/`.ogg`, short | Lock, match, chain, ability, game over |
| Music | `.mp3`/`.ogg`, looping | Background track |

---

## Adding a new region or champion

**New region** — add to `LOL.REGIONS` in `src/config.js`:

```js
shurima: { name: 'Shurima', short: 'SH', color: '#e0c169', art: 'assets/regions/shurima.svg' }
```

Drop `assets/regions/shurima.svg` in. That is it — it enters the piece pool
automatically.

**New champion** — add to `LOL.CHAMPIONS` in `src/config.js`, then write one
function in `src/abilities.js` with a matching `ability` key:

```js
// config.js
azir: {
  name: 'Azir', region: 'shurima', ability: 'my_new_effect',
  abilityName: 'Emperor\'s Divide',
  desc: 'What it does, shown in the side panel.',
  art: 'assets/champions/azir.svg'
}

// abilities.js — return the board indices to destroy
my_new_effect: function (board, x, y) {
  const destroy = [];
  // ... board.get(x, y), board.idx(x, y), board.inside(x, y), board.cols, board.rows
  return { destroy: destroy };
}
```

The champion's own cell is added to the destroy list automatically. Nothing else
in the codebase needs to change.

## Regenerating the placeholders

```bash
node tools/gen-placeholder-art.js
```

Overwrites everything in `assets/` with the generated placeholders. Do not run
this after you have added real art.
