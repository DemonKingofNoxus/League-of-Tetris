/*
 * render.js — draws the board. Knows nothing about rules.
 *
 * Art strategy: if an image exists for a region/champion it is drawn; if not,
 * a shaded tile with the region's short label is drawn instead. That means the
 * game looks intentional even with zero art files present.
 */
(function (LOL) {
  'use strict';

  const C = LOL.CONFIG;

  /* ---------- small colour helpers ---------- */

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ];
  }

  function shade(hex, amount) {
    const rgb = hexToRgb(hex).map(function (v) {
      return Math.max(0, Math.min(255, Math.round(amount > 0
        ? v + (255 - v) * amount
        : v * (1 + amount))));
    });
    return 'rgb(' + rgb.join(',') + ')';
  }

  function rgba(hex, alpha) {
    return 'rgba(' + hexToRgb(hex).join(',') + ',' + alpha + ')';
  }

  /* Cache derived shades — this runs for every tile of every frame. */
  const shadeCache = Object.create(null);
  function shades(hex) {
    let s = shadeCache[hex];
    if (!s) {
      s = shadeCache[hex] = {
        top: shade(hex, 0.30),
        bottom: shade(hex, -0.34),
        glow: rgba(hex, 0.55)
      };
    }
    return s;
  }

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

  Renderer.prototype.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  Renderer.prototype.tile = function (ctx, cell, px, py, size, opts) {
    if (!cell) return;
    opts = opts || {};

    const region = LOL.REGIONS[cell.region];
    const base = region ? region.color : '#8a8a8a';
    const sh = shades(base);

    const pad = Math.max(1, size * 0.045);
    const x = px + pad, y = py + pad, s = size - pad * 2;
    const r = size * 0.14;

    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;

    /* Champions get an outer glow in their region colour so they read as
       something that is about to happen, not just another block. */
    if (cell.champ) {
      ctx.shadowColor = sh.glow;
      ctx.shadowBlur = size * 0.55;
    }

    const grad = ctx.createLinearGradient(x, y, x, y + s);
    grad.addColorStop(0, sh.top);
    grad.addColorStop(0.52, base);
    grad.addColorStop(1, sh.bottom);
    ctx.fillStyle = grad;
    this.roundRect(ctx, x, y, s, s, r);
    ctx.fill();
    ctx.shadowBlur = 0;

    /* Specular sweep across the top third. */
    const gloss = ctx.createLinearGradient(x, y, x, y + s * 0.5);
    gloss.addColorStop(0, 'rgba(255,255,255,0.34)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    this.roundRect(ctx, x + s * 0.06, y + s * 0.05, s * 0.88, s * 0.42, r * 0.8);
    ctx.fill();

    const art = LOL.Assets.get(region && region.art);
    const champArt = cell.champ ? LOL.Assets.get(LOL.CHAMPIONS[cell.champ].art) : null;

    if (champArt) {
      ctx.save();
      this.roundRect(ctx, x, y, s, s, r);
      ctx.clip();
      ctx.drawImage(champArt, x, y, s, s);
      ctx.restore();
    } else if (cell.champ) {
      this.label(ctx, LOL.CHAMPIONS[cell.champ].name.slice(0, 2).toUpperCase(), x, y, s, size);
    } else if (art) {
      const inset = s * 0.08;
      ctx.drawImage(art, x + inset, y + inset, s - inset * 2, s - inset * 2);
    } else {
      this.label(ctx, region ? region.short : '?', x, y, s, size);
    }

    if (cell.champ) {
      /* Gold frame, so a champion is unmistakable at 30px. */
      ctx.strokeStyle = '#f0dca8';
      ctx.lineWidth = Math.max(1.5, size * 0.075);
      this.roundRect(ctx, x, y, s, s, r);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, x - 0.5, y - 0.5, s + 1, s + 1, r);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, x, y, s, s, r);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      this.roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r * 0.9);
      ctx.stroke();
    }

    ctx.restore();
  };

  Renderer.prototype.label = function (ctx, text, x, y, s, size) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '700 ' + Math.round(size * 0.3) + 'px ' +
               'ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + s / 2, y + s / 2 + size * 0.02);
  };

  /* ---------- frame ---------- */

  Renderer.prototype.draw = function (state) {
    const ctx = this.ctx;
    const cell = C.CELL;
    const board = state.board;

    /* Board bed: a soft vertical wash, darker at the bottom where the stack
       builds, so pieces stay legible as the board fills. */
    const bed = ctx.createLinearGradient(0, 0, 0, this.h);
    bed.addColorStop(0, '#0d1220');
    bed.addColorStop(1, '#080b12');
    ctx.fillStyle = bed;
    ctx.fillRect(0, 0, this.w, this.h);

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

    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        this.tile(ctx, board.get(x, y), x * cell, y * cell, cell);
      }
    }

    if (state.piece && state.pieceVisible) {
      const ghostY = board.dropY(state.piece);
      if (ghostY !== state.piece.y) {
        ctx.save();
        ctx.strokeStyle = C.UI.ghost;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        for (let y = 0; y < state.piece.matrix.length; y++) {
          for (let x = 0; x < state.piece.matrix[y].length; x++) {
            if (!state.piece.matrix[y][x]) continue;
            this.roundRect(ctx,
              (state.piece.x + x) * cell + 3, (ghostY + y) * cell + 3,
              cell - 6, cell - 6, cell * 0.12);
            ctx.stroke();
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

    /* Doomed blocks: a pulsing hot wash. Pure rows burn brighter, which is the
       only feedback that tells you the 5x landed before the score moves. */
    if (state.flash && state.flash.size) {
      const t = state.flashTimer / C.FLASH_MS;
      const pulse = 0.30 + 0.60 * Math.abs(Math.sin(t * Math.PI * 3));
      ctx.save();
      ctx.globalAlpha = state.flashPure ? Math.min(1, pulse * 1.25) : pulse;
      ctx.fillStyle = C.UI.flash;
      ctx.shadowColor = state.flashPure ? '#ffe9b0' : 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = state.flashPure ? 26 : 10;
      const self = this;
      state.flash.forEach(function (i) {
        const x = i % board.cols, y = Math.floor(i / board.cols);
        self.roundRect(ctx, x * cell + 1, y * cell + 1, cell - 2, cell - 2, cell * 0.14);
        ctx.fill();
      });
      ctx.restore();
    }

    /* Danger line: once the stack gets near the ceiling, mark it. */
    let top = board.rows;
    for (let y = 0; y < board.rows && top === board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        if (board.get(x, y)) { top = y; break; }
      }
    }
    if (top <= 4) {
      ctx.save();
      ctx.strokeStyle = 'rgba(209,85,79,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(0, 4 * cell + 0.5);
      ctx.lineTo(this.w, 4 * cell + 0.5);
      ctx.stroke();
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
    const size = Math.min(w / (pw + 0.7), h / (ph + 0.7), 34);
    const ox = (w - pw * size) / 2;
    const oy = (h - ph * size) / 2;

    for (let i = 0; i < filled.length; i++) {
      const x = filled[i][0], y = filled[i][1];
      this.tile(ctx, piece.cells[y][x], ox + (x - minX) * size, oy + (y - minY) * size, size);
    }
  };

  LOL.Renderer = Renderer;
  LOL.colorUtil = { shade: shade, rgba: rgba };

})(window.LOL);
