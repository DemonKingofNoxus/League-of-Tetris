# Art pipeline

Your original files live in **`assets/source/`** and are never modified.
`tools/process-art.py` turns them into the 128×128 tiles the game actually
loads, in `assets/regions/` and `assets/champions/`.

```bash
python3 tools/process-art.py
```

Requires Pillow: `pip install Pillow`.

---

## What is already done

**Region crests** — the six PNGs you supplied were already gold on a
transparent background, so there was no white background to remove. The script
trims the empty margin, pads each one to a square (the renderer draws tiles
square and would otherwise stretch a 101×162 crest), brightens the gold, and
adds a dark drop shadow so the crest still reads on the gold-ish Shurima tile.

The tile background colour is the region colour from `src/config.js`, kept
deliberately muted so six of them on screen at once are easy on the eyes:

| Region | Colour | Source file |
| --- | --- | --- |
| Noxus | `#a8474a` muted red | `noxus_crest_icon.png` |
| Void | `#8a63ad` muted purple | `void_crest_icon.png` |
| Freljord | `#5b90bd` muted blue | `freljord_crest_icon.png` |
| Zaun | `#67a15c` muted green | `zaun_crest_icon.png` |
| Ionia | `#c47ba0` muted pink | `iona_crest_icon.png` |
| Shurima | `#9a7830` deep amber | `shurima_crest_icon.png` |

Shurima is the one that had to move away from a bright yellow: a gold crest on
a gold tile was invisible. It is still clearly the yellow one, just deeper.

**Champion portraits** — the six splash arts were cropped square and centred on
each champion's head. Splash art at 26px is an unreadable smudge, so each crop
is tight to the face. The zoom is set **per champion**, because Darius is
painted much closer to camera than Sejuani; a single shared value would make him
a nostril and her a speck.

## Re-framing a portrait

Everything is in one table at the top of `tools/process-art.py`:

```python
# champion key -> (source, head_x, head_y, crop_height)
CHAMPIONS = {
    'ahri':    ('Ahri.jpg',    0.555, 0.200, 0.32),
    'darius':  ('Darius.jpg',  0.530, 0.180, 0.36),
    'kaisa':   ('Kaisa.jpg',   0.498, 0.180, 0.32),
    'sejuani': ('Sejuani.jpg', 0.540, 0.180, 0.19),
    'sivir':   ('Sivir.jpg',   0.533, 0.136, 0.22),
    'twitch':  ('Twitch.jpg',  0.658, 0.331, 0.22),
}
```

- `head_x`, `head_y` — where the head is, as a fraction of the image
  (0.5, 0.5 = dead centre). Move the crop *right* by raising `head_x`.
- `crop_height` — how much of the image height the square covers.
  **Smaller = more zoomed in.**

Change a number, re-run the script, reload the page. The crop is clamped to the
image, so a value near an edge will not crash — it just stops moving.

## Adding a new champion or region

**New region** — drop the crest in `assets/source/regions/`, add a line to
`REGIONS` in `tools/process-art.py`, and add an entry to `LOL.REGIONS` in
`src/config.js`:

```js
shadowIsles: { name: 'Shadow Isles', short: 'SI', color: '#4d8f7a',
               art: 'assets/regions/shadowIsles.png' }
```

It enters the piece pool automatically.

**New champion** — drop the splash in `assets/source/champions/`, add a line to
`CHAMPIONS` in `tools/process-art.py`, add an entry to `LOL.CHAMPIONS` in
`src/config.js`, then write one function in `src/abilities.js`:

```js
// config.js
thresh: {
  name: 'Thresh', region: 'shadowIsles', ability: 'my_new_effect',
  abilityName: 'Death Sentence',
  desc: 'What it does, shown in the side panel.',
  art: 'assets/champions/thresh.png'
}

// abilities.js — return the board indices to destroy
my_new_effect: function (board, x, y) {
  const destroy = [];
  // board.get(x, y) / board.idx(x, y) / board.inside(x, y) / board.cols / board.rows
  return { destroy: destroy };
}
```

The champion's own cell is added to the destroy list automatically, and it will
fire when a block of `region` touches it. Nothing else needs to change —
`test/engine.test.js` will fail if you add a champion whose ability or region
does not exist.

## If art is missing

Nothing breaks. A missing region file falls back to a flat coloured tile with a
two-letter label; a missing champion file falls back to its initials. You can
delete everything in `assets/` and the game still plays.

## Optional extras, not wired up yet

Say the word and I will add the code for any of these.

| What | Size | Use |
| --- | --- | --- |
| Logo / wordmark | ~600×160 PNG or SVG, transparent | Replace the text title |
| Board background | 320×640 PNG | Texture behind the grid |
| Ability icons | 64×64 PNG each | Next to champion names in the side panel |
| Sound effects | short `.mp3`/`.ogg` | Lock, row clear, pure row, ability, game over |
| Music | looping `.mp3`/`.ogg` | Background track |
