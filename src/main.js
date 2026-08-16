/*
 * main.js — game loop, input, level progression, UI wiring.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;
  const E = LOL.Engine;

  const el = {};
  ['board', 'next', 'ui-score', 'ui-level', 'ui-rows', 'ui-pure', 'ui-progress',
   'ui-target', 'ui-nextlevel', 'ui-champs', 'ui-regions', 'ui-region-count', 'ui-highscores',
   'overlay', 'overlay-title', 'overlay-body', 'overlay-btn', 'toast',
   'banner', 'banner-title', 'banner-sub', 'touch'
  ].forEach(function (id) {
    el[id.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] =
      document.getElementById(id);
  });

  let renderer, state, lastTime = 0, toastTimer = 0, bannerTimer = 0;

  /* High scores live in memory only: a page refresh wipes them, which is what
     was asked for until there are real accounts. */
  const highScores = [];

  /* ------------------------------------------------------------------ */
  /* Levels                                                              */
  /* ------------------------------------------------------------------ */

  /* Score needed to leave `level`. Past the authored table the targets keep
     growing so the run stays open-ended for high scores. */
  function targetFor(level) {
    const t = C.LEVEL_TARGETS;
    if (level <= t.length) return t[level - 1];
    let value = t[t.length - 1];
    for (let i = t.length; i < level; i++) value = Math.round(value * 1.35);
    return value;
  }

  function regionsForLevel(level) {
    return Math.min(LOL.REGION_KEYS.length,
      C.LEVEL_REGIONS_START + Math.min(level, C.LEVEL_COUNT) - 1);
  }

  /* Grow the pool by one random region that is not in it yet. */
  function expandRegions() {
    const want = regionsForLevel(state.level);
    const pool = LOL.REGION_KEYS.filter(function (k) {
      return state.regions.indexOf(k) === -1;
    });
    while (state.regions.length < want && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      state.regions.push(pool.splice(i, 1)[0]);
    }
    E.setActiveRegions(state.regions);
  }

  function checkLevelUp() {
    let promoted = false;
    while (state.score >= targetFor(state.level)) {
      state.level++;
      promoted = true;
    }
    if (!promoted) return;

    const before = state.regions.length;
    expandRegions();
    const added = state.regions.slice(before);

    banner('Level ' + state.level,
      added.length ? added.map(function (k) { return LOL.REGIONS[k].name; }).join(' · ') + ' joins the fight'
                   : 'All thirteen regions in play');
  }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  function newGame() {
    E.resetGenerator();

    const pool = LOL.REGION_KEYS.slice();
    const regions = [];
    while (regions.length < C.LEVEL_REGIONS_START && pool.length) {
      regions.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    E.setActiveRegions(regions);

    state = {
      board: new E.Board(),
      regions: regions,
      piece: E.makePiece(),
      next: E.makePiece(),
      phase: 'playing',        // playing | flash | paused | gameover
      pieceVisible: true,
      pendingSpawn: false,
      dropTimer: 0,
      lockTimer: 0,
      grounded: false,
      flash: null,
      flashKind: null,
      flashPure: false,
      flashTimer: 0,
      pendingRows: null,
      resolveSteps: 0,
      chain: 0,
      bestChain: 0,
      score: 0,
      level: 1,
      rowsCleared: 0,
      pureRows: 0,
      recorded: false
    };

    hideOverlay();
    syncUI();
    syncRegions();
  }

  function dropInterval() {
    return Math.max(C.DROP_MIN, C.DROP_BASE * Math.pow(C.DROP_FACTOR, state.level - 1));
  }

  /* ------------------------------------------------------------------ */
  /* Resolve cycle                                                       */
  /*   champions in contact fire first, then full rows clear, and the     */
  /*   fallout of either can set off the next round as a chain.           */
  /* ------------------------------------------------------------------ */

  function beginResolve(spawnAfter) {
    state.pendingSpawn = spawnAfter;
    state.chain = 0;
    state.resolveSteps = 0;
    stepResolve();
  }

  function stepResolve() {
    /* Safety net: every step destroys at least one block, so this can only
       trip if a champion is misconfigured. */
    if (++state.resolveSteps > 300) { endResolve(); return; }

    const trig = state.board.nextTriggeredChampion();
    if (trig) {
      const result = LOL.Abilities.trigger(state.board, trig.x, trig.y);
      if (result) {
        state.score += C.SCORE_ABILITY + (result.bonus || 0);
        toast(result.champ.name + ' — ' + result.champ.abilityName +
              (result.chained && result.chained.length
                ? '  (+' + result.chained.length + ' chained)' : ''));
        startFlash(new Set(result.destroy), 'ability', false);
        return;
      }
      /* Unknown ability — clear the block so we cannot loop on it. */
      state.board.set(trig.x, trig.y, null);
    }

    const rows = state.board.fullRows();
    if (rows.length) {
      const cells = new Set();
      const board = state.board;
      rows.forEach(function (r) {
        for (let x = 0; x < board.cols; x++) cells.add(board.idx(x, r.y));
      });
      state.pendingRows = rows;
      startFlash(cells, 'rows', rows.some(function (r) { return !!r.region; }));
      return;
    }

    endResolve();
  }

  function startFlash(cells, kind, pure) {
    state.flash = cells;
    state.flashKind = kind;
    state.flashPure = !!pure;
    state.flashTimer = C.FLASH_MS;
    state.phase = 'flash';
  }

  function commitFlash() {
    state.chain++;
    state.bestChain = Math.max(state.bestChain, state.chain);

    if (state.flashKind === 'rows') {
      const rows = state.pendingRows;
      let value = 0;
      let pureRegion = null;

      rows.forEach(function (r) {
        let v = C.SCORE_ROW;
        if (r.region) {
          v *= C.PURE_ROW_MULTIPLIER;
          state.pureRows++;
          pureRegion = r.region;
        }
        value += v;
      });

      const multi = C.MULTI_ROW[Math.min(rows.length, C.MULTI_ROW.length - 1)] || 1;
      state.score += Math.round(value * multi * state.level * state.chain);
      state.rowsCleared += rows.length;

      if (pureRegion) {
        toast('PURE ' + LOL.REGIONS[pureRegion].name.toUpperCase() +
              '  ×' + C.PURE_ROW_MULTIPLIER);
      } else if (state.chain > 1) {
        toast('Chain ×' + state.chain);
      }

      state.board.removeRows(rows);
      state.pendingRows = null;

    } else {
      state.score += state.flash.size * C.SCORE_PER_CELL * state.chain;
      state.board.remove(state.flash);
    }

    state.board.applyGravity();
    state.flash = null;
    state.flashKind = null;
    state.flashPure = false;
    checkLevelUp();
    syncUI();
    stepResolve();
  }

  function endResolve() {
    state.flash = null;
    state.flashKind = null;
    if (state.pendingSpawn) {
      state.piece = state.next;
      state.next = E.makePiece();
      state.pendingSpawn = false;
      if (state.board.collides(state.piece, state.piece.x, state.piece.y)) {
        gameOver();
        return;
      }
    }
    state.pieceVisible = true;
    state.lockTimer = 0;
    state.grounded = false;
    state.phase = 'playing';
    syncUI();
  }

  /* ------------------------------------------------------------------ */
  /* Piece control                                                       */
  /* ------------------------------------------------------------------ */

  function move(dx) {
    if (state.phase !== 'playing') return;
    if (!state.board.collides(state.piece, state.piece.x + dx, state.piece.y)) {
      state.piece.x += dx;
      state.lockTimer = 0;
    }
  }

  function rotate(dir) {
    if (state.phase !== 'playing') return;
    const rotated = E.rotatePiece(state.piece, dir);
    const kicks = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];
    for (let i = 0; i < kicks.length; i++) {
      const nx = state.piece.x + kicks[i][0];
      const ny = state.piece.y + kicks[i][1];
      if (!state.board.collides(rotated, nx, ny)) {
        rotated.x = nx;
        rotated.y = ny;
        state.piece = rotated;
        state.lockTimer = 0;
        return;
      }
    }
  }

  function softDrop() {
    if (state.phase !== 'playing') return;
    if (!state.board.collides(state.piece, state.piece.x, state.piece.y + 1)) {
      state.piece.y++;
      state.score += C.SCORE_SOFT_DROP;
      state.dropTimer = 0;
      syncUI();
    }
  }

  function hardDrop() {
    if (state.phase !== 'playing') return;
    const target = state.board.dropY(state.piece);
    state.score += (target - state.piece.y) * C.SCORE_HARD_DROP;
    state.piece.y = target;
    lockPiece();
  }

  function lockPiece() {
    state.board.lock(state.piece);
    state.pieceVisible = false;
    beginResolve(true);
  }

  function gameOver() {
    state.phase = 'gameover';
    state.pieceVisible = false;
    recordScore();
    showOverlay('Game over',
      state.score.toLocaleString() + ' points · level ' + state.level + ' · ' +
      state.rowsCleared + ' rows (' + state.pureRows + ' pure)',
      'Play again');
  }

  /* ------------------------------------------------------------------ */
  /* High scores — session memory only                                   */
  /* ------------------------------------------------------------------ */

  function recordScore() {
    if (state.recorded || state.score <= 0) return;
    state.recorded = true;

    const entry = {
      score: state.score,
      level: state.level,
      rows: state.rowsCleared,
      pure: state.pureRows,
      fresh: true
    };
    highScores.forEach(function (h) { h.fresh = false; });
    highScores.push(entry);
    highScores.sort(function (a, b) { return b.score - a.score; });
    if (highScores.length > C.HIGHSCORE_LIMIT) highScores.length = C.HIGHSCORE_LIMIT;
    syncHighScores();
  }

  function syncHighScores() {
    if (!highScores.length) {
      el.uiHighscores.innerHTML = '<li class="empty">no runs yet</li>';
      return;
    }
    el.uiHighscores.innerHTML = highScores.map(function (h, i) {
      return '<li class="' + (h.fresh ? 'fresh' : '') + '">' +
             '<span class="rank">' + (i + 1) + '</span>' +
             '<span class="pts">' + h.score.toLocaleString() + '</span>' +
             '<span class="meta">L' + h.level + ' · ' + h.rows + 'r · ' + h.pure + 'p</span>' +
             '</li>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */

  function update(dt) {
    if (state.phase === 'flash') {
      state.flashTimer -= dt;
      if (state.flashTimer <= 0) commitFlash();
      return;
    }

    if (state.phase !== 'playing') return;

    state.dropTimer += dt;
    if (state.dropTimer >= dropInterval()) {
      state.dropTimer = 0;
      if (!state.board.collides(state.piece, state.piece.x, state.piece.y + 1)) {
        state.piece.y++;
        state.grounded = false;
        state.lockTimer = 0;
      } else {
        state.grounded = true;
      }
    }

    if (state.grounded || state.board.collides(state.piece, state.piece.x, state.piece.y + 1)) {
      state.lockTimer += dt;
      if (state.lockTimer >= C.LOCK_DELAY) lockPiece();
    }
  }

  function frame(time) {
    const dt = Math.min(100, time - lastTime); // clamp so tab-switching can't fast-forward
    lastTime = time;

    if (state) {
      update(dt);
      renderer.draw(state);
      renderer.drawNext(state.next);
    }

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.classList.remove('show');
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) el.banner.classList.remove('show');
    }

    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */

  function syncUI() {
    el.uiScore.textContent = state.score.toLocaleString();
    el.uiLevel.textContent = state.level;
    el.uiRows.textContent = state.rowsCleared;
    el.uiPure.textContent = state.pureRows;

    const target = targetFor(state.level);
    const floor = state.level > 1 ? targetFor(state.level - 1) : 0;
    const pct = Math.max(0, Math.min(100,
      100 * (state.score - floor) / Math.max(1, target - floor)));
    el.uiProgress.style.width = pct.toFixed(1) + '%';
    el.uiTarget.textContent = state.score.toLocaleString() + ' / ' + target.toLocaleString();
    el.uiNextlevel.textContent = state.level + 1;

    const champs = state.board.champions();
    if (!champs.length) {
      el.uiChamps.innerHTML = '<li class="empty">none on the board</li>';
    } else {
      const seen = {};
      el.uiChamps.innerHTML = champs.map(function (c) {
        if (seen[c.key]) return '';
        seen[c.key] = true;
        const champ = LOL.CHAMPIONS[c.key];
        const region = LOL.REGIONS[champ.region];
        const art = LOL.Assets.get(champ.art);
        return '<li>' +
          (art ? '<img src="' + champ.art + '" alt="">' :
                 '<span class="swatch" style="background:' + region.color + '"></span>') +
          '<div><b>' + champ.name + '</b>' +
          '<span>' + champ.abilityName + '</span>' +
          '<em>' + champ.desc + '</em>' +
          '<i class="trigger"><span class="swatch" style="background:' + region.color +
          '"></span>needs ' + region.name + '</i></div></li>';
      }).join('');
    }
  }

  /* The roster of regions currently in play, with the featured one lit. */
  function syncRegions() {
    const featured = E.getFeatured();
    el.uiRegionCount.textContent = state.regions.length + ' / ' + LOL.REGION_KEYS.length;
    el.uiRegions.innerHTML = state.regions.map(function (k) {
      const r = LOL.REGIONS[k];
      const art = LOL.Assets.get(r.art);
      const bg = art ? 'background-image:url(' + r.art + ');background-color:' + r.color + ';'
                     : 'background-color:' + r.color + ';';
      return '<li class="' + (k === featured ? 'featured' : '') + '" style="color:' + r.color + '">' +
             '<span class="swatch" style="' + bg + '"></span>' +
             '<span>' + r.name + '</span></li>';
    }).join('');
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    toastTimer = 1300;
  }

  function banner(title, sub) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub;
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;   // restart the animation
    el.banner.classList.add('show');
    bannerTimer = 1900;
    syncRegions();
  }

  function showOverlay(title, body, btn) {
    el.overlayTitle.textContent = title;
    el.overlayBody.textContent = body;
    el.overlayBtn.textContent = btn;
    el.overlay.classList.remove('hidden');
  }

  function hideOverlay() { el.overlay.classList.add('hidden'); }

  function togglePause() {
    if (state.phase === 'paused') {
      state.phase = state.resumePhase || 'playing';
      hideOverlay();
    } else if (state.phase === 'playing' || state.phase === 'flash') {
      state.resumePhase = state.phase;
      state.phase = 'paused';
      showOverlay('Paused', 'Press P or the button to resume.', 'Resume');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(k) !== -1) {
      e.preventDefault();
    }
    if (k === 'p') { togglePause(); return; }
    if (k === 'r') { newGame(); return; }
    if (state.phase === 'gameover' && (k === 'enter' || k === ' ')) { newGame(); return; }
    if (state.phase !== 'playing') return;

    switch (k) {
      case 'arrowleft': case 'a': move(-1); break;
      case 'arrowright': case 'd': move(1); break;
      case 'arrowdown': case 's': softDrop(); break;
      case 'arrowup': case 'x': case 'w': rotate(1); break;
      case 'z': rotate(-1); break;
      case ' ': hardDrop(); break;
    }
  }

  const TOUCH_ACTIONS = {
    left:  function () { move(-1); },
    right: function () { move(1); },
    rot:   function () { rotate(1); },
    down:  function () { softDrop(); },
    drop:  function () { hardDrop(); }
  };

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  function boot() {
    renderer = new LOL.Renderer(el.board, el.next);
    newGame();
    syncHighScores();

    /* The featured region rotates as pieces are generated, so refresh the
       roster periodically rather than on every frame. */
    setInterval(function () { if (state && state.phase === 'playing') syncRegions(); }, 900);

    document.addEventListener('keydown', onKey);

    el.overlayBtn.addEventListener('click', function () {
      if (state.phase === 'gameover') newGame();
      else togglePause();
    });

    el.touch.addEventListener('click', function (e) {
      const act = e.target.getAttribute('data-act');
      if (act && TOUCH_ACTIONS[act]) TOUCH_ACTIONS[act]();
    });

    window.addEventListener('resize', function () { renderer.scale(); });

    requestAnimationFrame(function (t) { lastTime = t; frame(t); });
  }

  /* Handle for tests and for tinkering from the browser console. */
  LOL.game = {
    get state() { return state; },
    get highScores() { return highScores; },
    newGame: newGame,
    move: move,
    rotate: rotate,
    hardDrop: hardDrop,
    targetFor: targetFor,
    regionsForLevel: regionsForLevel
  };

  /* Art is optional, so boot regardless of whether it loads. */
  LOL.Assets.preload().then(boot, boot);

})(window.LOL);
