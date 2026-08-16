# Runeterra Blocks

A Tetris-like puzzle game where every block carries a **region**, and lining up
three or more of the same region destroys them. **Champion blocks** are 1×1,
land like any other piece, and fire a unique ability when you click them.

Pure HTML/CSS/JavaScript. No build step, no frameworks, no dependencies.

---

## Run it

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

You can also just double-click `index.html` — it is written as classic scripts
(not ES modules) specifically so it works straight off the filesystem.

To put it online, push this folder to GitHub and turn on **GitHub Pages**
(Settings → Pages → deploy from branch). That is the whole deployment.

## Play it

| Key | Action |
| --- | --- |
| <kbd>←</kbd> <kbd>→</kbd> | Move |
| <kbd>↓</kbd> | Soft drop |
| <kbd>↑</kbd> / <kbd>X</kbd> | Rotate |
| <kbd>Z</kbd> | Rotate back |
| <kbd>Space</kbd> | Hard drop |
| <kbd>P</kbd> | Pause |
| <kbd>R</kbd> | Restart |
| **Click a champion** | Fire its ability |

On phones an on-screen button row appears automatically.

## Rules

- Each cell of a falling piece is tagged with a region. A piece has one
  *primary* region (~62% of its cells) plus some mixed in, so pieces are
  readable but still need to be planned around.
- **3 or more of the same region in a row or column is destroyed.** This is the
  main scoring rule.
- **A completely filled row always clears**, whatever the regions are. This is
  the safety valve so a messy board is still recoverable.
- After a clear, blocks fall to fill the gap and matches are re-checked —
  **chains** multiply your score.
- Champions count as their own region for matching, so they can complete a
  line. They are also destroyed by matches, so use them before you lose them.

### Champions

| Champion | Region | Ability | Effect |
| --- | --- | --- | --- |
| Darius | Noxus | Noxian Guillotine | Destroys the whole column below him |
| Lux | Demacia | Final Spark | Destroys her entire row |
| Ziggs | Zaun | Mega Inferno Bomb | Destroys a 3×3 area |
| Ashe | Freljord | Frost Shot | Converts all 8 neighbours to Freljord |
| Yasuo | Ionia | Steel Tempest | Destroys the columns to his left and right |
| Miss Fortune | Bilgewater | Double Up | Destroys every block sharing the region beneath her |

Firing an ability consumes the champion block.

---

## Project layout

```
index.html          markup + panel layout
css/style.css       all styling
src/config.js       ← REGIONS, CHAMPIONS, tuning numbers. Edit this one.
src/assets.js       image loading, with fallback when art is missing
src/engine.js       pure rules: board, pieces, matching, gravity
src/abilities.js    champion click effects
src/render.js       canvas drawing
src/main.js         game loop, input, UI
test/engine.test.js headless rule tests
tools/balance.js    simulates a good player to check the game is survivable
tools/gen-placeholder-art.js  regenerates the placeholder crests
assets/             art — see ASSETS.md
```

`src/engine.js` and `src/abilities.js` touch no DOM and no canvas. That is
deliberate: it is what lets the same rules run in a browser today and inside a
desktop build later without a rewrite.

## Add your own art

The game is fully playable with **zero art files** — missing images fall back to
a coloured tile with a label. Drop art in one file at a time and it appears.
See **[ASSETS.md](ASSETS.md)** for the exact list, sizes and formats.

## Tune the game

Everything worth tweaking is at the top of `src/config.js`:

```js
MATCH_MIN: 3,             // how many in a line destroys them
CHAMPION_CHANCE: 0.14,    // how often a champion piece spawns
PRIMARY_REGION_BIAS: 0.62,
DROP_BASE: 800,           // fall speed at level 1
```

Adding a champion is two edits: an entry in `LOL.CHAMPIONS` (config.js) and one
function in `abilities.js`. Nothing else needs to know about it.

## Tests

```bash
node test/engine.test.js    # rule tests — matching, gravity, every ability, 300-piece soak
node tools/balance.js       # is the game actually survivable? (simulates a decent player)
```

The balance sim currently reports that an attentive player never tops out and
clears ~3.5 of every 4 cells they place, across 400 pieces.

---

## Web now, Steam later

**Yes, this code can become a Steam game.** You do not rewrite it.

A web game ships to Steam by wrapping it in a desktop shell:

| Option | What it is | Trade-off |
| --- | --- | --- |
| **Electron** | Bundles Chromium + Node into an `.exe` | Easiest, best documented, ~80 MB output |
| **Tauri** | Uses the OS's own webview, Rust shell | ~5 MB output, slightly more setup |
| **NW.js** | Similar to Electron | Older, smaller community |

Steam does not care what is inside the executable — it just launches it. Plenty
of shipped Steam games are Electron-wrapped web apps.

Roughly: `npm i -D electron`, a ~20-line `main.js` that opens a window pointing
at `index.html`, then `electron-builder` to produce the `.exe`. Your game code
is unchanged.

If you want **achievements, cloud saves or the Steam overlay**, add the
Steamworks SDK through [`steamworks.js`](https://github.com/ceifa/steamworks.js).
That is the only genuinely Steam-specific code you would write, and it stays in
the shell, not in the game.

**When would you rewrite?** Only if you need something the web cannot do —
console ports (PlayStation/Xbox/Switch do not accept Electron), or heavy 3D. For
a 2D puzzle game, neither applies. If you ever do move, `engine.js` and
`abilities.js` are plain logic and port to Godot/Unity almost line for line;
only rendering and input would be rewritten.

### How Steam publishing works

1. **Create a Steamworks account** at partner.steamgames.com. You need company
   or personal identity details.
2. **Pay the Steam Direct fee: $100 USD per game.** It is recoupable — Valve
   returns it once the game earns $1,000 in adjusted gross revenue.
3. **Tax and banking paperwork.** US tax interview (W-8BEN for non-US
   individuals) plus bank details. This step gates everything else and takes
   from a few days to a few weeks to clear.
4. **Set up the store page** — name, description, capsule images, screenshots,
   trailer, tags, price. Valve reviews the store page before it can go public.
5. **Upload builds with SteamPipe** (`steamcmd` + a small config file, or the
   SteamPipe GUI). You upload the folder your build produces.
6. **Build review.** Valve checks the build actually runs and matches the store
   page. Usually a few business days; expect at least one round of notes.
7. **Store page must be public for at least 14 days before release.** This is a
   hard rule — plan your release date around it.
8. **Set a release date and hit the button.** Valve takes 30% of revenue
   (dropping at $10M and $50M lifetime, which will not be your problem yet).

Realistic timeline from "I want to publish" to "it is live": **4–8 weeks**,
mostly waiting on paperwork and the mandatory 14-day window.

### One thing to sort out before you sell anything

League of Legends — its regions, champions, names and art — is Riot Games'
intellectual property. Riot's
[Legal Jibber Jabber](https://www.riotgames.com/en/legal) permits fan projects
that are **free and non-commercial**. A free browser game is the normal, tolerated
case. **Selling it on Steam is not**, and Riot art assets (including Data Dragon)
are licensed for non-commercial use only.

This is why the theme in this repo lives entirely in `src/config.js` and
`assets/`. Nothing in `engine.js`, `abilities.js` or `render.js` knows what a
"region" or a "champion" is called. When you want to sell it:

1. Rewrite `config.js` with your own factions and characters.
2. Replace the files in `assets/`.
3. Ship it.

Same engine, same abilities, same feel — legally yours. Build the fan version
for free on the web to find out whether the game is fun; reskin it for the
commercial release.
