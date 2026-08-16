/*
 * assets.js — image loading with graceful degradation.
 *
 * Nothing here ever blocks the game. If an image is missing or broken the
 * renderer just draws a flat coloured tile instead, so you can drop your art
 * in one file at a time and watch it appear.
 */
(function (LOL) {
  'use strict';

  const cache = Object.create(null); // path -> HTMLImageElement (only if usable)

  function load(path) {
    return new Promise(function (resolve) {
      if (!path) { resolve(null); return; }
      const img = new Image();
      img.onload = function () {
        // Zero-sized SVGs are worse than no art at all.
        if (img.width === 0 || img.height === 0) { resolve(null); return; }
        cache[path] = img;
        resolve(img);
      };
      img.onerror = function () { resolve(null); };
      img.src = path;
    });
  }

  /* Kick off every image in the theme. Resolves once all have settled. */
  function preload() {
    const paths = [];
    Object.keys(LOL.REGIONS).forEach(function (k) { paths.push(LOL.REGIONS[k].art); });
    Object.keys(LOL.CHAMPIONS).forEach(function (k) { paths.push(LOL.CHAMPIONS[k].art); });
    return Promise.all(paths.map(load));
  }

  function get(path) {
    return path ? (cache[path] || null) : null;
  }

  LOL.Assets = { preload: preload, get: get, load: load };

})(window.LOL);
