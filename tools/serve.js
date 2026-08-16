#!/usr/bin/env node
/*
 * serve.js — a tiny static web server for local development.
 *
 *   npm start            (or: node tools/serve.js)
 *   npm start -- 3000    to pick a different port
 *
 * Uses only Node's built-in modules, so there is nothing to install — no
 * `npm install`, no Python, no internet connection required.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORT = 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-cache' }, headers || {}));
  res.end(body);
}

const server = http.createServer(function (req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (err) {
    send(res, 400, 'Bad request');
    return;
  }

  if (urlPath.endsWith('/')) urlPath += 'index.html';

  /* Resolve inside ROOT and refuse anything that escapes it, so a request for
     /../../etc/passwd cannot read outside the project. */
  const filePath = path.resolve(ROOT, '.' + urlPath);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      send(res, 404, 'Not found: ' + urlPath, { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(filePath)
      .on('error', function () { res.destroy(); })
      .pipe(res);
  });
});

const requested = Number(process.argv[2]) || DEFAULT_PORT;

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Port ' + requested + ' is already in use.');
    console.error('  Try another one:  npm start -- ' + (requested + 1) + '\n');
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

server.listen(requested, function () {
  console.log('\n  Runeterra Blocks is running.');
  console.log('\n      http://localhost:' + requested + '\n');
  console.log('  Serving ' + ROOT);
  console.log('  Press Ctrl+C to stop.\n');
});
