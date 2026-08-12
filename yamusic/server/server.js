const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');

const { config, validateConfig } = require('./config');
const { createAuthToken, parseAuthToken, checkPassword, tokenFromRequest } = require('./auth');
const yandex = require('./yandex');
const cache = require('./cache');
const { handleStream } = require('./stream');

const APP_DIR = path.join(__dirname, '..', 'app');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, 'Слишком большое тело запроса');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Некорректный JSON');
  }
}

// ── Защита от подбора пароля ──────────────────────────────────────────────────

const loginAttempts = new Map();

function checkLoginRate(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (entry.resetAt < now) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60 * 1000;
  }
  entry.count += 1;
  loginAttempts.set(ip, entry);
  if (entry.count > 10) throw new HttpError(429, 'Слишком много попыток входа, подождите 15 минут');
}

// ── Маршруты ──────────────────────────────────────────────────────────────────

const routes = [
  {
    method: 'GET',
    pattern: '/api/health',
    auth: false,
    async handler(_req, res) {
      sendJson(res, 200, { ok: true, configured: validateConfig().length === 0 });
    },
  },
  {
    method: 'POST',
    pattern: '/api/login',
    auth: false,
    async handler(req, res) {
      checkLoginRate(req.socket.remoteAddress || 'unknown');
      const body = await readJsonBody(req);
      if (!checkPassword(body.password)) throw new HttpError(401, 'Неверный пароль');
      sendJson(res, 200, { token: createAuthToken(body.device) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/account',
    async handler(_req, res) {
      sendJson(res, 200, await yandex.accountStatus());
    },
  },
  {
    method: 'GET',
    pattern: '/api/search',
    async handler(_req, res, _params, url) {
      const text = (url.searchParams.get('q') || '').trim();
      if (!text) throw new HttpError(400, 'Пустой запрос');
      const type = url.searchParams.get('type') || 'track';
      const page = Number(url.searchParams.get('page') || 0);
      sendJson(res, 200, await yandex.search(text, type, page));
    },
  },
  {
    method: 'GET',
    pattern: '/api/playlists',
    async handler(_req, res) {
      sendJson(res, 200, { playlists: await yandex.myPlaylists() });
    },
  },
  {
    method: 'GET',
    pattern: '/api/playlists/:kind',
    async handler(_req, res, params, url) {
      sendJson(res, 200, await yandex.playlistTracks(params.kind, url.searchParams.get('uid')));
    },
  },
  {
    method: 'GET',
    pattern: '/api/likes',
    async handler(_req, res) {
      sendJson(res, 200, { tracks: await yandex.likedTracks() });
    },
  },
  {
    method: 'GET',
    pattern: '/api/albums/:id',
    async handler(_req, res, params) {
      sendJson(res, 200, await yandex.albumTracks(params.id));
    },
  },
  {
    method: 'GET',
    pattern: '/api/artists/:id/tracks',
    async handler(_req, res, params) {
      sendJson(res, 200, { tracks: await yandex.artistTracks(params.id) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/tracks',
    async handler(_req, res, _params, url) {
      const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
      sendJson(res, 200, { tracks: await yandex.tracksByIds(ids) });
    },
  },
  {
    method: 'GET',
    pattern: '/api/stations',
    async handler(_req, res) {
      sendJson(res, 200, { stations: await yandex.stations() });
    },
  },
  {
    method: 'GET',
    pattern: '/api/stations/:id/tracks',
    async handler(_req, res, params, url) {
      sendJson(res, 200, await yandex.stationTracks(params.id, url.searchParams.get('queue')));
    },
  },
  {
    method: 'POST',
    pattern: '/api/stations/:id/feedback',
    async handler(req, res, params) {
      const body = await readJsonBody(req);
      const ok = await yandex.stationFeedback(params.id, body.type || 'trackStarted', body);
      sendJson(res, 200, { ok });
    },
  },
  {
    method: 'GET',
    pattern: '/api/stream/:id',
    async handler(req, res, params, url) {
      await handleStream(req, res, params.id, url.searchParams.get('q') || config.defaultQuality);
    },
  },
  {
    method: 'GET',
    pattern: '/api/cover',
    async handler(_req, res, _params, url) {
      const uri = url.searchParams.get('uri') || '';
      const size = /^\d+x\d+$/.test(url.searchParams.get('size') || '') ? url.searchParams.get('size') : '400x400';
      const target = uri.startsWith('http') ? uri : yandex.coverUrl(uri, size);
      if (!target) throw new HttpError(400, 'Не указана обложка');
      const host = new URL(target).hostname;
      if (!host.endsWith('yandex.net') && !host.endsWith('yandex.ru')) {
        throw new HttpError(400, 'Недопустимый хост обложки');
      }
      const upstream = await fetch(target.replace('%%', size));
      if (!upstream.ok || !upstream.body) throw new HttpError(502, 'Обложка недоступна');
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=604800',
      });
      Readable.fromWeb(upstream.body).pipe(res);
    },
  },
  {
    method: 'GET',
    pattern: '/api/cache',
    async handler(_req, res) {
      sendJson(res, 200, await cache.stats());
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/cache',
    async handler(_req, res) {
      sendJson(res, 200, { removed: await cache.clear() });
    },
  },
];

function matchPattern(pattern, pathname) {
  const expected = pattern.split('/');
  const actual = pathname.split('/');
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i].startsWith(':')) {
      if (!actual[i]) return null;
      params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    } else if (expected[i] !== actual[i]) {
      return null;
    }
  }
  return params;
}

// ── Статика PWA ───────────────────────────────────────────────────────────────

async function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.join(APP_DIR, relative);
  if (!file.startsWith(APP_DIR)) throw new HttpError(403, 'Запрещено');

  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    throw new HttpError(404, 'Не найдено');
  }
  if (!stat.isFile()) throw new HttpError(404, 'Не найдено');

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    // Service worker и index обновляем всегда, остальное можно подержать в кэше браузера
    'Cache-Control': ext === '.html' || relative === 'sw.js' ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

// ── Сервер ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method === 'HEAD' ? 'GET' : req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname.startsWith('/api/')) {
      const route = routes
        .map((r) => (r.method === method ? { r, params: matchPattern(r.pattern, pathname) } : null))
        .find((entry) => entry && entry.params);

      if (!route) throw new HttpError(404, 'Метод API не найден');

      if (route.r.auth !== false) {
        if (!parseAuthToken(tokenFromRequest(req, url))) {
          throw new HttpError(401, 'Нужен вход в приложение');
        }
      }
      await route.r.handler(req, res, route.params, url);
    } else {
      await serveStatic(req, res, pathname);
    }
  } catch (err) {
    const status = err.status || 500;
    if (!res.headersSent) {
      if (pathname.startsWith('/api/')) {
        sendJson(res, status, { error: err.message || 'Внутренняя ошибка' });
      } else {
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(err.message || 'Ошибка');
      }
    } else {
      res.destroy();
    }
    if (status >= 500) console.error(`[error] ${method} ${pathname}: ${err.stack || err.message}`);
  } finally {
    if (config.logRequests) {
      res.on('close', () => {
        console.log(`${method} ${pathname} → ${res.statusCode} (${Date.now() - started}мс)`);
      });
    }
  }
});

const problems = validateConfig();
if (problems.length) {
  console.warn('Проверьте server/.env:');
  for (const problem of problems) console.warn(`  • ${problem}`);
}

if (config.cacheEnabled) {
  fs.mkdirSync(path.join(config.cacheDir, 'high'), { recursive: true });
  fs.mkdirSync(path.join(config.cacheDir, 'low'), { recursive: true });
  cache.enforceLimit().catch(() => {});
}

server.listen(config.port, config.host, () => {
  console.log(`yamusic-proxy слушает http://${config.host}:${config.port}`);
  console.log(`кэш: ${config.cacheEnabled ? config.cacheDir : 'выключен'}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\nПолучен ${signal}, останавливаемся`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
