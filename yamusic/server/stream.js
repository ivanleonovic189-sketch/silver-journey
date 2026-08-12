const fs = require('fs');
const { Readable } = require('stream');
const { config } = require('./config');
const yandex = require('./yandex');
const cache = require('./cache');

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start;
  let end;
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

function contentType(codec) {
  if (codec === 'aac' || codec === 'mp4') return 'audio/mp4';
  if (codec === 'flac') return 'audio/flac';
  return 'audio/mpeg';
}

// Отдаём из локального кэша сервера — Яндекс в этот раз не трогаем вообще
function serveFromDisk(req, res, entry, type) {
  const range = parseRange(req.headers.range, entry.size);
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'X-Yamusic-Source': 'cache',
  };

  if (range) {
    headers['Content-Length'] = range.end - range.start + 1;
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${entry.size}`;
    res.writeHead(206, headers);
  } else {
    headers['Content-Length'] = entry.size;
    res.writeHead(200, headers);
  }

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = fs.createReadStream(entry.file, range ? { start: range.start, end: range.end } : {});
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

// Проксируем поток из Яндекса «на лету», прозрачно пробрасывая Range для перемотки
async function proxyLive(req, res, link, type, trackId, quality) {
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const upstreamHeaders = {};
  if (req.headers.range) upstreamHeaders.Range = req.headers.range;

  let upstream;
  try {
    upstream = await fetch(link.url, {
      method: req.method === 'HEAD' ? 'GET' : req.method,
      headers: upstreamHeaders,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    throw new yandex.YandexError(`Не удалось получить поток: ${err.message}`, 502);
  }

  if (!upstream.ok && upstream.status !== 206) {
    throw new yandex.YandexError(`Хранилище Яндекса ответило HTTP ${upstream.status}`, 502);
  }

  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'X-Yamusic-Source': 'live',
    'X-Yamusic-Bitrate': String(link.bitrate || ''),
  };
  const length = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  if (length) headers['Content-Length'] = length;
  if (contentRange) headers['Content-Range'] = contentRange;

  res.writeHead(upstream.status === 206 ? 206 : 200, headers);

  // Первое проигрывание (запрос без Range или с начала файла) — заодно кладём трек в кэш
  const fromStart = !req.headers.range || /^bytes=0-/.test(String(req.headers.range));
  if (fromStart) cache.fill(trackId, quality, link.url);

  if (req.method === 'HEAD' || !upstream.body) {
    res.end();
    controller.abort();
    return;
  }

  const body = Readable.fromWeb(upstream.body);
  body.on('error', () => res.destroy());
  res.on('close', () => body.destroy());
  body.pipe(res);
}

async function handleStream(req, res, trackId, requestedQuality) {
  const quality = requestedQuality === 'low' ? 'low' : 'high';

  const cached = await cache.cachedFile(trackId, quality);
  if (cached) {
    serveFromDisk(req, res, cached, 'audio/mpeg');
    return;
  }

  const link = await yandex.directLink(trackId, quality);
  await proxyLive(req, res, link, contentType(link.codec), trackId, quality);
}

module.exports = { handleStream, parseRange };
