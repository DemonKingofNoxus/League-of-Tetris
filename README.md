# League of Tetris

Tetris across the thirteen regions of Runeterra. Rows clear the normal way —
but a row that is **entirely one region** pays **5×**. **Champion** blocks are
1×1 and fire their ability **automatically** the moment they touch a block of
their own region; if they never touch it, they just sit there as dead weight.

Eleven levels: level 1 features 3 random regions, and each level adds another
until all 13 are in play. Levels are gated by score, and the run keeps going
past level 11 so high scores stay open-ended.

Pure HTML/CSS/JavaScript. No build step, no frameworks, no dependencies.

---

## Run it on localhost

**You need [Node.js](https://nodejs.org) — nothing else.** No Python, and no
`npm install`: the server uses only Node's built-in modules.

```bash
git clone https://github.com/budala187/gamte_test.git
cd gamte_test
git checkout claude/lol-tetris-game-72dveo
npm start
```

It prints the URL. Open **<http://localhost:8000>**. Stop it with
<kbd>Ctrl</kbd>+<kbd>C</kbd>.

If port 8000 is taken, pick another:

```bash
npm start -- 3000
```

If you already cloned the repo, `git pull` first.

### If you do not want to use npm

| Command | Needs |
| --- | --- |
| `node tools/serve.js` | Node (identical to `npm start`) |
| `npx serve .` | Node + internet, downloads a package |
| `python3 -m http.server 8000` | Python installed and on PATH |
| double-click `index.html` | nothing at all |

That last one really does work — the game is written as classic scripts rather
than ES modules specifically so it runs straight off the filesystem. You lose
nothing except a realistic hosting setup.

**VS Code users:** install the *Live Server* extension, right-click
`index.html`, "Open with Live Server". It reloads the page whenever you save.

### Other npm scripts

```bash
npm test        # rule tests
npm run balance # is the game survivable, and are pure rows reachable?
npm run art     # rebuild tiles from assets/source/ (this one needs Python + Pillow)
```

### Putting it online

Push to GitHub, then Settings → Pages → deploy from branch. That is the entire
deployment — it will be live at `https://budala187.github.io/gamte_test/`.

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

On phones an on-screen button row appears automatically.

## Rules

- **Full rows clear**, exactly like normal Tetris. The board is 12 wide.
- **A row that is entirely one region pays 5×.** That is the thing to play for.
  Clearing 2–5 rows at once multiplies on top.
- Each piece is a single region. One region is **featured** at a time and gets
  about 70% of the pieces, the rest are spread over the others — so the board
  stays visibly mixed while you can still bank enough of one region to finish a
  pure row.
- **Champions are 1×1 and fire on contact.** The instant a block of their own
  region ends up next to them (up, down, left or right) the ability goes off.
  Another champion of the same region counts as contact too.
- A champion that lands away from its region **settles and stays**, taking up
  space until its region reaches it.
- Firing an ability consumes the champion. Whatever it destroys falls, which
  can complete rows and chain.
- **Levels** are reached by score. Each one brings another region into the
  pool and speeds the drop up.

### The thirteen champions

| Champion | Region | Ability | Effect |
| --- | --- | --- | --- |
| Darius | Noxus | Noxian Guillotine | Executes the whole column below him |
| Kayle | Demacia | Divine Judgment | Destroys a circle around her |
| Gwen | Shadow Isles | Snip Snip! | A cone widening downward |
| Ahri | Ionia | Orb of Deception | Destroys one row horizontally |
| Sivir | Shurima | Boomerang Blade | Every Shurima block on the board |
| Twitch | Zaun | Spray and Pray | 5 random blocks, any region |
| Kai'Sa | Void | Icathian Rain | The 3×3 around her |
| Sejuani | Freljord | Glacial Prison | Every block on the board |
| Pyke | Bilgewater | Death from Below | An X through both diagonals |
| Teemo | Bandle City | Noxious Trap | 3 shrooms, each a 2×2 blast |
| Qiyana | Ixtal | Supreme Display of Talent | A hollow O — the middle survives |
| Aurelion Sol | Targon | Falling Star | The whole board, plus a big bonus |
| Caitlyn | Piltover | Ace in the Hole | Destroys every champion block **and sets off their abilities** |

You listed Caitlyn under Bilgewater, but you also listed Pyke there and shipped
a Piltover crest — so Caitlyn is Piltover here, which makes it exactly one
champion per region.

### High scores

Kept in memory for the session and shown beside the board. **A page refresh
clears them** — that is deliberate until there is an account system.

---

## Project layout

```
index.html          markup + panel layout
css/style.css       all styling
src/config.js       ← REGIONS, CHAMPIONS, tuning numbers. Edit this one.
src/assets.js       image loading, with fallback when art is missing
src/engine.js       pure rules: board, pieces, rows, gravity, contact triggers
src/abilities.js    the thirteen champion effects
src/render.js       canvas drawing
src/main.js         game loop, input, UI
test/engine.test.js headless rule tests
tools/process-art.py  turns assets/source/ into game-ready tiles
tools/balance.js    simulates a good player to check the game is survivable
assets/source/      your original art, untouched
assets/regions/     generated 128px region tiles
assets/champions/   generated 128px champion portraits
```

`src/engine.js` and `src/abilities.js` touch no DOM and no canvas. That is
deliberate: it is what lets the same rules run in a browser today and inside a
desktop build later without a rewrite.

## Art

Your originals live in `assets/source/` and are never modified. To re-crop a
portrait or swap a crest, edit the numbers at the top of
`tools/process-art.py` and run:

```bash
python3 tools/process-art.py
```

See **[ASSETS.md](ASSETS.md)** for the details.

## Tune the game

Everything worth tweaking is at the top of `src/config.js`:

```js
COLS: 12,                     // board width
PURE_ROW_MULTIPLIER: 5,       // what a single-region row pays
FEATURED_SHARE: 0.70,         // share of pieces using the featured region
FEATURE_ROTATE_MIN/MAX: 8/14, // pieces before the feature changes
CHAMPION_CHANCE: 0.20,        // how often a champion piece spawns
CHAMPION_MATCHES_FEATURE: 0.6,
CHAMPION_CONTACT_DIAGONAL: false,
LEVEL_REGIONS_START: 3,       // regions at level 1
LEVEL_TARGETS: [...],         // score gates per level
DROP_BASE: 850,               // fall speed at level 1
```

Adding a champion is two edits: an entry in `LOL.CHAMPIONS` (config.js) and one
function in `abilities.js`. Nothing else needs to know about it.

## Tests

```bash
node test/engine.test.js    # rules: rows, purity, contact triggers, all six abilities, 400-piece soak
node tools/balance.js       # is the game survivable, and are pure rows reachable?
```

Current numbers from `tools/balance.js`, using a simulated player:

- Survival-focused play clears ~35 rows over 250 pieces and fires **26–37
  champion abilities per game**.
- A player actively chasing pure rows gets **~8–11% of clears pure**, but dies
  roughly half as deep — greed costs you, which is what makes the 5× a
  decision rather than free points.

**The one honest trade-off:** widening the board to 12 and mixing the regions
for variety both make "entirely one region" harder. Those two requests pull
against the 5× bonus. If pure rows feel too rare when you play it, raise
`FEATURED_SHARE` toward 0.85 (more of one region at a time) or drop `COLS`
back to 10 — both are one-line changes in `src/config.js`.

---

## Web now, Steam later

**This code can become a Steam game — you do not rewrite it.** A web game ships
to Steam wrapped in a desktop shell:

| Option | What it is | Trade-off |
| --- | --- | --- |
| **Electron** | Bundles Chromium + Node into an `.exe` | Easiest, best documented, ~80 MB |
| **Tauri** | Uses the OS's own webview, Rust shell | ~5 MB, slightly more setup |

Steam does not care what is inside the executable. Achievements, cloud saves and
the overlay come from [`steamworks.js`](https://github.com/ceifa/steamworks.js)
and live in the shell, not in your game code.

You would only rewrite for consoles (PlayStation/Xbox/Switch do not accept
Electron) or heavy 3D. Neither applies to a 2D puzzle game.

### How Steam publishing works

1. **Steamworks account** at partner.steamgames.com.
2. **$100 USD per game** (Steam Direct). Recoupable once the game earns $1,000.
3. **Tax and banking paperwork.** Gates everything else; days to weeks.
4. **Store page** — capsule art, screenshots, trailer, tags, price. Reviewed.
5. **Upload builds with SteamPipe.**
6. **Build review** by Valve, usually a few business days.
7. **Store page must be public 14 days before release.** Hard rule.
8. **Release.** Valve takes 30%.

Realistically **4–8 weeks**, mostly waiting on paperwork and the 14-day window.

### Read this before spending the $100

League of Legends — its regions, champions, names and art — is Riot Games'
intellectual property, and Riot's policy is stricter than "just keep it free":

- Riot grants a **non-commercial, revocable** licence for fan projects. Free
  only: no sales, no ads, no paid tiers.
- Riot's developer policy explicitly says **no fan games** using their IP — no
  simulators, no recreations, nothing hard to tell apart from an official Riot
  product. Free fan *celebrations* built on your own original ideas are the
  category they permit.
- You may not use Riot logos or trademarks without a written agreement.
- Anything you do share must carry a notice that it was created under Riot's
  fan-content policy using assets owned by Riot Games.

So there is **no legal way to make money on the League-themed version** — not on
Steam, not with ads, not with donations. Do not pay the $100 for this build; you
could not publish it.

**The way you actually earn that back:** this repo keeps the entire theme in
`src/config.js` and `assets/`. Nothing in `engine.js`, `abilities.js` or
`render.js` knows what a "region" or a "champion" is called. So:

1. Use the League build privately, or as a free unlisted page, to find out
   whether the game is fun.
2. Rewrite `config.js` with your own factions and characters, and replace
   `assets/`.
3. That version is yours. Sell it on Steam, itch.io, anywhere.

Same engine, same abilities, same feel — and the only thing you throw away is
art you were never allowed to sell.

Sources: [Riot Games Legal](https://www.riotgames.com/en/legal) ·
[Riot Developer General Policies](https://support-developer.riotgames.com/hc/en-us/articles/22698591841939-General-Policies)
