const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { config } = require('./config');

// Треки, которые прямо сейчас качаются в кэш — чтобы не тянуть один и тот же дважды
const inFlight = new Set();

function cachePath(trackId, quality) {
  const safeId = String(trackId).replace(/[^\w-]/g, '');
  return path.join(config.cacheDir, quality === 'low' ? 'low' : 'high', `${safeId}.mp3`);
}

async function cachedFile(trackId, quality) {
  if (!config.cacheEnabled) return null;
  const file = cachePath(trackId, quality);
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile() || stat.size === 0) return null;
    // Обновляем atime, чтобы вытеснение работало как LRU
    fsp.utimes(file, new Date(), stat.mtime).catch(() => {});
    return { file, size: stat.size };
  } catch {
    return null;
  }
}

async function listCacheFiles() {
  const files = [];
  for (const quality of ['high', 'low']) {
    const dir = path.join(config.cacheDir, quality);
    let names;
    try {
      names = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        const stat = await fsp.stat(file);
        if (stat.isFile()) files.push({ file, size: stat.size, atimeMs: stat.atimeMs });
      } catch {
        // файл могли удалить параллельно
      }
    }
  }
  return files;
}

// Вытесняем самые давно не игравшиеся файлы, пока не влезем в лимит
async function enforceLimit() {
  const files = await listCacheFiles();
  let total = files.reduce((sum, f) => sum + f.size, 0);
  if (total <= config.cacheMaxBytes) return;
  files.sort((a, b) => a.atimeMs - b.atimeMs);
  for (const entry of files) {
    if (total <= config.cacheMaxBytes) break;
    try {
      await fsp.unlink(entry.file);
      total -= entry.size;
    } catch {
      // уже удалён
    }
  }
}

// Скачиваем трек целиком в фоне: следующее прослушивание пойдёт с диска сервера
async function fill(trackId, quality, url) {
  if (!config.cacheEnabled) return;
  const key = `${trackId}:${quality}`;
  if (inFlight.has(key)) return;
  if (await cachedFile(trackId, quality)) return;
  inFlight.add(key);

  const file = cachePath(trackId, quality);
  const tmp = `${file}.part`;
  try {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
    await fsp.rename(tmp, file);
    await enforceLimit();
  } catch (err) {
    await fsp.unlink(tmp).catch(() => {});
    console.warn(`[cache] не удалось закэшировать ${trackId}: ${err.message}`);
  } finally {
    inFlight.delete(key);
  }
}

async function stats() {
  const files = await listCacheFiles();
  return {
    enabled: config.cacheEnabled,
    tracks: files.length,
    bytes: files.reduce((sum, f) => sum + f.size, 0),
    limitBytes: config.cacheMaxBytes,
  };
}

async function clear() {
  const files = await listCacheFiles();
  for (const entry of files) await fsp.unlink(entry.file).catch(() => {});
  return files.length;
}

module.exports = { cachedFile, fill, stats, clear, enforceLimit };
