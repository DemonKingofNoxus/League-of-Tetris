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
| Sejuani | Freljord | Glacial Prison | A random 3×3 area of the board |
| Pyke | Bilgewater | Death from Below | An X through both diagonals |
| Teemo | Bandle City | Noxious Trap | 3 shrooms, each a 2×2 blast |
| Qiyana | Ixtal | Supreme Display of Talent | Every block along the **edge of the field** |
| Aurelion Sol | Targon | Falling Star | The whole board, plus a big bonus |
| Caitlyn | Piltover | Ace in the Hole | Destroys every champion block **and sets off their abilities** |

You listed Caitlyn under Bilgewater, but you also listed Pyke there and shipped
a Piltover crest — so Caitlyn is Piltover here, which makes it exactly one
champion per region.

### Gold

Gold is earned only for playing the game's own systems, never for merely
surviving:

| Event | Gold |
| --- | --- |
| A champion ability lands | **1 per block destroyed** |
| A row clears in a single region | **5 per block** — 60 on a 12-wide board |
| An ordinary mixed row clears | **nothing** |
| Chain step beyond the first | **+25%** each |
| Every level above 1 | **+5%** each |

A ~300-piece game (roughly seven minutes) pays about **500 gold**, or ~70 per
minute, measured with `tools/balance.js`. Nearly all of it comes from
champion abilities; a pure row is a rare jackpot. Useful when you set shop
prices later: a skin at 2,500 is about five good games, an unlock at 5,000
about ten.

The rates are `GOLD_*` in `src/config.js`.

### High scores and accounts

Without an account, high scores stay in memory and a refresh clears them.
**With an account, gold and high scores are saved** and you appear on the
public leaderboard. See below.

---

## Project layout

```
index.html          markup + panel layout
css/style.css       all styling
src/config.js       ← REGIONS, CHAMPIONS, rates, per-level tables. Edit this one.
src/supabase-config.js  your project URL + anon key (optional)
src/tuning.js       resolves "what is this number at level N?"
src/gold.js         what each event is worth in gold
src/cloud.js        accounts, gold and leaderboards over Supabase's REST API
src/account.js      the account panel and leaderboard UI
src/assets.js       image loading, with fallback when art is missing
src/engine.js       pure rules: board, pieces, rows, gravity, contact triggers
src/abilities.js    the thirteen champion effects
src/render.js       canvas drawing
src/main.js         game loop, input, UI
test/engine.test.js headless rule tests
tools/process-art.py  turns assets/source/ into game-ready tiles
tools/balance.js    simulates a good player to check the game is survivable
tools/rates.js      prints the effective probabilities, level by level
supabase/schema.sql tables, policies and the submit_run function
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
COLS: 12,                       // board width
PURE_ROW_MULTIPLIER: 5,         // what a single-region row pays
FEATURED_SHARE: 0.45,           // share of pieces using the featured region
FEATURE_ROTATE_MIN/MAX: 8/14,   // pieces before the feature changes
CHAMPION_CHANCE: 0.30,          // how often a champion piece spawns
CHAMPION_MATCHES_FEATURE: 0.50, // how often that champion suits the feature
CHAMPION_CONTACT_DIAGONAL: false,
LEVEL_REGIONS_START: 3,         // regions at level 1
LEVEL_TARGETS: [...],           // score gates per level
DROP_BASE: 850,                 // fall speed at level 1
```

### Per-champion spawn rate

Every champion in `LOL.CHAMPIONS` has a `weight`:

```js
sejuani: { name: 'Sejuani', region: 'freljord', ..., weight: 1 },
```

It is **relative, not a percentage** — weight 2 is twice as likely as weight 1
among the champions currently in play, and **weight 0 means it never spawns**.
Weights rather than percentages so you can change one champion without having
to rebalance the other twelve to keep a total of 100.

### Per-level overrides

Two tables in `config.js` override any of the above, per level. Entries
**cascade**: a value set at level 3 stays in force at 4, 5, 6… until a later
level changes that same key, so you only write the levels where something
actually changes.

```js
LEVEL_TUNING: {
  1: { CHAMPION_CHANCE: 0.30, FEATURED_SHARE: 0.45 },
  4: { CHAMPION_CHANCE: 0.26 },                        // levels 4-7
  8: { FEATURED_SHARE: 0.38, CHAMPION_MATCHES_FEATURE: 0.40 },
},

LEVEL_CHAMPION_WEIGHTS: {
  1: { sejuani: 0.5, aurelionSol: 0 },  // hold the big ones back early
  6: { aurelionSol: 1 },                // let Aurelion Sol in from level 6
},
```

Both ship empty, so the base values apply at every level until you fill them
in. To see the result:

```bash
npm run rates       # every level
node tools/rates.js 7   # just level 7
```

That prints the real numbers through the same tuning layer the game uses,
including what each champion's weight works out to as a share of all pieces.

Adding a champion is two edits: an entry in `LOL.CHAMPIONS` (config.js) and one
function in `abilities.js`. Nothing else needs to know about it.

## Tests

```bash
npm test            # rules, all 13 abilities, the tuning layer, a 500-piece soak
npm run balance     # is the game survivable, and are pure rows reachable?
npm run rates       # the effective probabilities at every level
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

## Accounts and leaderboards

Optional. Leave it unconfigured and the game runs exactly as before — local
session scores, gold tracked for the run only, and the account panel says it
is switched off. Nothing else changes.

Turning it on takes about five minutes:

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier
   is plenty).
2. **Run the schema.** Open the SQL editor, paste all of
   [`supabase/schema.sql`](supabase/schema.sql), run it once.
3. **Switch off email confirmation.** Authentication → Providers → Email →
   *Confirm email* = **off**. Players sign up with a username only, so there is
   no mailbox to confirm.
4. **Fill in `src/supabase-config.js`** with your project URL and the key
   marked **anon / public** (Project Settings → API).

That is it. The account panel under the board turns into a sign-up form.

### If sign-up fails

Open the browser console and run:

```js
await LOL.Cloud.diagnose()
```

It checks each piece in turn and prints a table saying which one is broken.
The same check is behind the **Check connection** button that appears in the
account panel after a failure.

The three failures that actually happen:

**"Email address … is invalid" on sign-up.** The `emailDomain` uses a reserved
TLD. See *How usernames work without email* above.

**404, and nothing at all in the Supabase logs.** The request never left your
own domain. The usual cause is a project url without `https://` — `fetch`
treats `abc.supabase.co` as a *relative path*, so the call goes to your own
host and your host answers 404. The url is now normalised automatically and
warns in the console, but check `src/supabase-config.js` reads
`https://<project>.supabase.co`.

**404 from `/rest/v1/profiles` after the schema ran fine.** PostgREST serves
those endpoints from a cached picture of the schema, and a table that
definitely exists still answers 404 until it catches up. Run:

```sql
notify pgrst, 'reload schema';
```

`supabase/schema.sql` ends with that line, so a full re-run also fixes it.

### How usernames work without email

Supabase always wants an email address. Each username is mapped to
`<username>@<emailDomain>` from `supabase-config.js`. No mail is ever sent to
it, and the player never sees it.

**The domain must have a real public suffix.** Supabase Auth validates the
address and rejects the reserved test TLDs — `.invalid`, `.test`, `.example`,
`.local`, `.localhost` — with *Email address "…" is invalid*. Those are the
intuitive choice for a deliberately-fake address and are exactly the ones that
fail. The client now refuses them up front, warns in the console, and flags
them in `diagnose()`, rather than letting every signup die with a message
about email that makes no sense to someone who only typed a username.

A domain **you already own** is the right answer. It can never collide with a
stranger's real mailbox, and it needs no mail server, because nothing is ever
delivered. The default is the site's own Vercel domain:

```js
emailDomain: 'league-of-tetris-one.vercel.app'
```

If your Supabase project rejects that too, use any other domain you control —
a custom domain, or a subdomain of one. Failing that, a mailbox provider's
domain works, at the cost of colliding with real addresses.

**Settle on this before real players sign up.** The address is what identifies
an account, so changing `emailDomain` later orphans every existing one.

Usernames are 3–16 characters of letters, numbers and underscore — enforced in
the client, and again by a `CHECK` constraint in the database.

### What is public and what is protected

The anon key is public by design; anyone can read it out of the page source.
**The Row Level Security policies in the schema are what protect the data**,
not the key:

- `profiles` is readable by anyone — that is what makes the leaderboard work.
- **No client can INSERT, UPDATE or DELETE a profile.** Creation happens in a
  signup trigger; changes go only through the `submit_run` function, which
  takes `greatest(old, new)` for the high score and *adds* gold. A weak run can
  never lower a record.
- `runs` are readable only by their owner.
- The leaderboard is a **view** exposing exactly four columns, so anything
  added to `profiles` later cannot leak into it by accident.

**One honest limitation:** `submit_run` still trusts the numbers the client
sends. Somebody who edits the JavaScript can claim any score. The function
rejects negatives, impossible values and absurd magnitudes, which stops
accidents and casual tampering, but a determined cheat needs the run
simulated server-side. Worth knowing before you promote the leaderboard.

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
