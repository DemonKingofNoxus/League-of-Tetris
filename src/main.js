/*
 * main.js — game loop, input, UI wiring.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;
  const E = LOL.Engine;

  const el = {
    board:    document.getElementById('board'),
    next:     document.getElementById('next'),
    score:    document.getElementById('ui-score'),
    level:    document.getElementById('ui-level'),
    rows:     document.getElementById('ui-rows'),
    pure:     document.getElementById('ui-pure'),
    champs:   document.getElementById('ui-champs'),
    regions:  document.getElementById('ui-regions'),
    overlay:  document.getElementById('overlay'),
    oTitle:   document.getElementById('overlay-title'),
    oBody:    document.getElementById('overlay-body'),
    oBtn:     document.getElementById('overlay-btn'),
    toast:    document.getElementById('toast'),
    touch:    document.getElementById('touch')
  };

  let renderer, state, lastTime = 0, toastTimer = 0;

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  function newGame() {
    state = {
      board: new E.Board(),
      piece: E.makePiece(),
      next: E.makePiece(),
      phase: 'playing',        // playing | flash | paused | gameover
      pieceVisible: true,
      pendingSpawn: false,     // does the current resolve end with a new piece?
      dropTimer: 0,
      lockTimer: 0,
      grounded: false,
      flash: null,
      flashKind: null,         // 'rows' | 'ability'
      flashTimer: 0,
      pendingRows: null,
      resolveSteps: 0,
      chain: 0,
      bestChain: 0,
      score: 0,
      level: 1,
      rowsCleared: 0,
      pureRows: 0
    };
    hideOverlay();
    syncUI();
  }

  function dropInterval() {
    return Math.max(C.DROP_MIN, C.DROP_BASE * Math.pow(0.85, state.level - 1));
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
    if (++state.resolveSteps > 200) { endResolve(); return; }

    const trig = state.board.nextTriggeredChampion();
    if (trig) {
      const result = LOL.Abilities.trigger(state.board, trig.x, trig.y);
      if (result) {
        state.score += C.SCORE_ABILITY;
        toast(result.champ.name + ' — ' + result.champ.abilityName);
        startFlash(new Set(result.destroy), 'ability');
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
      startFlash(cells, 'rows');
      return;
    }

    endResolve();
  }

  function startFlash(cells, kind) {
    state.flash = cells;
    state.flashKind = kind;
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
      state.level = 1 + Math.floor(state.rowsCleared / C.ROWS_PER_LEVEL);

      if (pureRegion) {
        toast('PURE ' + LOL.REGIONS[pureRegion].name.toUpperCase() +
              '!  x' + C.PURE_ROW_MULTIPLIER);
      } else if (state.chain > 1) {
        toast('Chain x' + state.chain + '!');
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
    // Simple wall kicks: try in place, then nudge sideways, then up.
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
    showOverlay('Game over', 'Score ' + state.score.toLocaleString() +
                ' · level ' + state.level + ' · ' + state.rowsCleared + ' rows', 'Play again');
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

    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */

  function syncUI() {
    el.score.textContent = state.score.toLocaleString();
    el.level.textContent = state.level;
    el.rows.textContent = state.rowsCleared;
    el.pure.textContent = state.pureRows;

    const champs = state.board.champions();
    if (!champs.length) {
      el.champs.innerHTML = '<li class="champ-empty">none on the board</li>';
    } else {
      const seen = {};
      el.champs.innerHTML = champs.map(function (c) {
        if (seen[c.key]) return '';
        seen[c.key] = true;
        const champ = LOL.CHAMPIONS[c.key];
        const region = LOL.REGIONS[champ.region];
        return '<li><b>' + champ.name + '</b>' +
               '<span>' + champ.abilityName + '</span>' +
               '<em>' + champ.desc + '</em>' +
               '<i class="trigger"><span class="swatch" style="background:' + region.color +
               '"></span>fires on contact with ' + region.name + '</i></li>';
      }).join('');
    }
  }

  function buildRegionLegend() {
    el.regions.innerHTML = LOL.REGION_KEYS.map(function (k) {
      const r = LOL.REGIONS[k];
      return '<li><span class="swatch" style="background:' + r.color + '"></span>' + r.name + '</li>';
    }).join('');
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    toastTimer = 1200;
  }

  function showOverlay(title, body, btn) {
    el.oTitle.textContent = title;
    el.oBody.textContent = body;
    el.oBtn.textContent = btn;
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
    buildRegionLegend();
    newGame();

    document.addEventListener('keydown', onKey);

    el.oBtn.addEventListener('click', function () {
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
    newGame: newGame,
    move: move,
    rotate: rotate,
    hardDrop: hardDrop
  };

  /* Art is optional, so boot regardless of whether it loads. */
  LOL.Assets.preload().then(boot, boot);

})(window.LOL);
