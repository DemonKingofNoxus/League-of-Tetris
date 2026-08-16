/*
 * render.js — draws the board. Knows nothing about rules.
 *
 * Art strategy: if an image exists for a region/champion it is drawn; if not,
 * a flat coloured tile with the region's short label is drawn instead. That
 * means the game looks intentional even with zero art files present.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;

  function Renderer(canvas, nextCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d');

    /* Remember the logical size once. Assigning canvas.width also rewrites the
       width attribute, so re-reading it after scaling would compound the
       device-pixel-ratio on every resize and blow the drawing off-canvas. */
    this.w = Number(canvas.getAttribute('width'));
    this.h = Number(canvas.getAttribute('height'));
    this.nextW = Number(nextCanvas.getAttribute('width'));
    this.nextH = Number(nextCanvas.getAttribute('height'));

    this.scale();
  }

  /* Match the backing store to the device pixel ratio so tiles stay crisp. */
  Renderer.prototype.scale = function () {
    const dpr = window.devicePixelRatio || 1;
    const sizes = [
      [this.canvas, this.ctx, this.w, this.h],
      [this.nextCanvas, this.nextCtx, this.nextW, this.nextH]
    ];
    sizes.forEach(function (s) {
      const el = s[0], ctx = s[1], w = s[2], h = s[3];
      el.width = w * dpr;
      el.height = h * dpr;
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  };

  /* ---------- tile drawing ---------- */

  Renderer.prototype.tile = function (ctx, cell, px, py, size, alpha) {
    if (!cell) return;
    const region = LOL.REGIONS[cell.region];
    const color = region ? region.color : '#888';

    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;

    const pad = Math.max(1, size * 0.05);
    const x = px + pad, y = py + pad, s = size - pad * 2;

    // Base plate — always drawn, so transparent art still reads as a block.
    ctx.fillStyle = color;
    this.roundRect(ctx, x, y, s, s, size * 0.16);
    ctx.fill();

    // Inner bevel for depth.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    this.roundRect(ctx, x, y, s, s * 0.34, size * 0.14);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    this.roundRect(ctx, x, y + s * 0.72, s, s * 0.28, size * 0.14);
    ctx.fill();

    const art = LOL.Assets.get(region && region.art);
    const champArt = cell.champ ? LOL.Assets.get(LOL.CHAMPIONS[cell.champ].art) : null;

    if (champArt) {
      ctx.drawImage(champArt, x, y, s, s);
    } else if (cell.champ) {
      this.label(ctx, LOL.CHAMPIONS[cell.champ].name.slice(0, 2).toUpperCase(), x, y, s, size);
    } else if (art) {
      const inset = s * 0.09;
      ctx.drawImage(art, x + inset, y + inset, s - inset * 2, s - inset * 2);
    } else {
      this.label(ctx, region ? region.short : '?', x, y, s, size);
    }

    // Champions get a bright ring so it is obvious they are clickable.
    if (cell.champ) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, size * 0.07);
      this.roundRect(ctx, x, y, s, s, size * 0.16);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, x, y, s, s, size * 0.16);
      ctx.stroke();
    }

    ctx.restore();
  };

  Renderer.prototype.label = function (ctx, text, x, y, s, size) {
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.font = '700 ' + Math.round(size * 0.36) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + s / 2, y + s / 2 + size * 0.02);
  };

  Renderer.prototype.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  /* ---------- frame ---------- */

  Renderer.prototype.draw = function (state) {
    const ctx = this.ctx;
    const cell = C.CELL;
    const board = state.board;

    ctx.fillStyle = C.UI.grid;
    ctx.fillRect(0, 0, this.w, this.h);

    // Grid lines
    ctx.strokeStyle = C.UI.gridLine;
    ctx.lineWidth = 1;
    for (let x = 1; x < board.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, this.h);
      ctx.stroke();
    }
    for (let y = 1; y < board.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(this.w, y * cell + 0.5);
      ctx.stroke();
    }

    // Settled blocks
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        this.tile(ctx, board.get(x, y), x * cell, y * cell, cell);
      }
    }

    // Ghost + active piece
    if (state.piece && state.pieceVisible) {
      const ghostY = board.dropY(state.piece);
      if (ghostY !== state.piece.y) {
        ctx.save();
        ctx.fillStyle = C.UI.ghost;
        for (let y = 0; y < state.piece.matrix.length; y++) {
          for (let x = 0; x < state.piece.matrix[y].length; x++) {
            if (!state.piece.matrix[y][x]) continue;
            this.roundRect(ctx,
              (state.piece.x + x) * cell + 2, (ghostY + y) * cell + 2,
              cell - 4, cell - 4, cell * 0.16);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      for (let y = 0; y < state.piece.matrix.length; y++) {
        for (let x = 0; x < state.piece.matrix[y].length; x++) {
          if (!state.piece.matrix[y][x]) continue;
          this.tile(ctx, state.piece.cells[y][x],
            (state.piece.x + x) * cell, (state.piece.y + y) * cell, cell);
        }
      }
    }

    // Flash overlay on cells about to be destroyed
    if (state.flash && state.flash.size) {
      const t = state.flashTimer / C.FLASH_MS;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(t * Math.PI * 3));
      ctx.fillStyle = C.UI.flash;
      state.flash.forEach(function (i) {
        const x = i % board.cols, y = Math.floor(i / board.cols);
        ctx.fillRect(x * cell, y * cell, cell, cell);
      });
      ctx.restore();
    }
  };

  /* ---------- next-piece preview ---------- */

  Renderer.prototype.drawNext = function (piece) {
    const ctx = this.nextCtx;
    const w = this.nextW;
    const h = this.nextH;
    ctx.clearRect(0, 0, w, h);
    if (!piece) return;

    // Trim empty rows/cols so the preview is centred regardless of shape.
    const filled = [];
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (piece.matrix[y][x]) filled.push([x, y]);
      }
    }
    if (!filled.length) return;

    const xs = filled.map(function (p) { return p[0]; });
    const ys = filled.map(function (p) { return p[1]; });
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    const pw = maxX - minX + 1, ph = maxY - minY + 1;
    const size = Math.min(w / (pw + 0.6), h / (ph + 0.6), 30);
    const ox = (w - pw * size) / 2;
    const oy = (h - ph * size) / 2;

    for (let i = 0; i < filled.length; i++) {
      const x = filled[i][0], y = filled[i][1];
      this.tile(ctx, piece.cells[y][x], ox + (x - minX) * size, oy + (y - minY) * size, size);
    }
  };

  LOL.Renderer = Renderer;

})(window.LOL);
