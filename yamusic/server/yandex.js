const crypto = require('crypto');
const { config } = require('./config');

const API_BASE = 'https://api.music.yandex.net';

// Соль для подписи прямой ссылки на файл (алгоритм мобильного клиента)
const SIGN_SALT = 'XGRlBW9FXlekgbPrRHuSiA';

// Ссылка живёт около 10 минут, кэшируем чуть меньше
const LINK_TTL_MS = 8 * 60 * 1000;

class YandexError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'YandexError';
    this.status = status || 502;
  }
}

function apiHeaders() {
  return {
    Authorization: `OAuth ${config.yandexToken}`,
    'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
    'User-Agent': 'Yandex-Music-API',
    'Accept-Language': 'ru',
  };
}

async function api(pathname, options = {}) {
  const { method = 'GET', query, form } = options;
  const url = new URL(API_BASE + pathname);
  for (const [key, value] of Object.entries(query || {})) {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  }

  const init = { method, headers: apiHeaders() };
  if (form) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(form).toString();
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new YandexError(`Сеть недоступна: ${err.message}`, 502);
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new YandexError(`Яндекс вернул не JSON (HTTP ${res.status})`, 502);
  }

  if (json && json.error) {
    const name = json.error.name || json.error;
    throw new YandexError(`Яндекс: ${json.error.message || name}`, res.status === 401 ? 401 : 502);
  }
  if (!res.ok) {
    if (res.status === 401) throw new YandexError('Токен Яндекс Музыки недействителен', 401);
    throw new YandexError(`Яндекс ответил HTTP ${res.status}`, 502);
  }
  return json.result;
}

// ── Нормализация ──────────────────────────────────────────────────────────────

// coverUri приходит как "avatars.yandex.net/get-music-content/xxx/%%"
function coverUrl(uri, size = '400x400') {
  if (!uri) return null;
  return `https://${uri.replace('%%', size)}`;
}

function normalizeTrack(raw) {
  if (!raw) return null;
  const track = raw.track || raw;
  if (!track.id && !track.realId) return null;
  const album = (track.albums && track.albums[0]) || track.album || null;
  return {
    id: String(track.realId || track.id),
    title: track.title + (track.version ? ` (${track.version})` : ''),
    artists: (track.artists || []).map((a) => a.name).join(', ') || 'Неизвестный исполнитель',
    album: album ? album.title : '',
    albumId: album ? String(album.id) : '',
    durationMs: track.durationMs || 0,
    cover: coverUrl(track.coverUri || (album && album.coverUri), '400x400'),
    available: track.available !== false,
  };
}

function normalizePlaylist(raw) {
  if (!raw) return null;
  return {
    kind: String(raw.kind),
    uid: String(raw.uid || (raw.owner && raw.owner.uid) || ''),
    title: raw.title,
    trackCount: raw.trackCount || 0,
    cover: coverUrl(
      (raw.cover && (raw.cover.uri || (raw.cover.itemsUri && raw.cover.itemsUri[0]))) || raw.ogImage,
      '400x400',
    ),
    description: raw.description || '',
  };
}

// ── Каталог ───────────────────────────────────────────────────────────────────

async function accountStatus() {
  const result = await api('/account/status');
  const account = result.account || {};
  return {
    uid: String(account.uid || ''),
    login: account.login || '',
    displayName: (account.fullName || account.displayName || account.login || '').trim(),
    hasPlus: Boolean(result.plus && result.plus.hasPlus),
    subscribed: Boolean(
      result.subscription &&
        (result.subscription.hadAnySubscription || result.subscription.autoRenewable),
    ),
  };
}

let cachedUid = null;
async function currentUid() {
  if (!cachedUid) cachedUid = (await accountStatus()).uid;
  if (!cachedUid) throw new YandexError('Не удалось определить uid аккаунта', 502);
  return cachedUid;
}

async function search(text, type = 'track', page = 0) {
  const result = await api('/search', { query: { text, type, page, nocorrect: false } });
  const section = result[`${type}s`] || {};
  const items = section.results || [];
  if (type === 'track') return { tracks: items.map(normalizeTrack).filter(Boolean) };
  if (type === 'playlist') return { playlists: items.map(normalizePlaylist).filter(Boolean) };
  if (type === 'album') {
    return {
      albums: items.map((a) => ({
        id: String(a.id),
        title: a.title,
        artists: (a.artists || []).map((x) => x.name).join(', '),
        year: a.year || '',
        cover: coverUrl(a.coverUri, '400x400'),
      })),
    };
  }
  if (type === 'artist') {
    return {
      artists: items.map((a) => ({
        id: String(a.id),
        name: a.name,
        cover: coverUrl(a.cover && a.cover.uri, '400x400'),
      })),
    };
  }
  return {};
}

async function myPlaylists() {
  const uid = await currentUid();
  const result = await api(`/users/${uid}/playlists/list`);
  return (result || []).map(normalizePlaylist).filter(Boolean);
}

async function playlistTracks(kind, uid) {
  const owner = uid || (await currentUid());
  const result = await api(`/users/${owner}/playlists/${kind}`);
  const tracks = (result.tracks || []).map(normalizeTrack).filter(Boolean);
  // У чужих/сгенерированных плейлистов приходят только id — дотягиваем метаданные
  if (!tracks.length && result.trackIds && result.trackIds.length) {
    return { playlist: normalizePlaylist(result), tracks: await tracksByIds(result.trackIds) };
  }
  return { playlist: normalizePlaylist(result), tracks };
}

async function tracksByIds(ids) {
  const list = (ids || []).map((id) => String(id).split(':')[0]).filter(Boolean);
  if (!list.length) return [];
  const out = [];
  // API не любит слишком длинные пачки — режем по 200
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    const result = await api('/tracks', { method: 'POST', form: { 'track-ids': chunk.join(',') } });
    out.push(...(result || []).map(normalizeTrack).filter(Boolean));
  }
  return out;
}

async function likedTracks() {
  const uid = await currentUid();
  const result = await api(`/users/${uid}/likes/tracks`);
  const ids = ((result.library && result.library.tracks) || []).map((t) => t.id);
  return tracksByIds(ids);
}

async function albumTracks(albumId) {
  const result = await api(`/albums/${albumId}/with-tracks`);
  const volumes = result.volumes || [];
  return {
    album: {
      id: String(result.id),
      title: result.title,
      artists: (result.artists || []).map((a) => a.name).join(', '),
      cover: coverUrl(result.coverUri, '400x400'),
    },
    tracks: volumes.flat().map(normalizeTrack).filter(Boolean),
  };
}

async function artistTracks(artistId) {
  const result = await api(`/artists/${artistId}/tracks`, { query: { page: 0, 'page-size': 100 } });
  return (result.tracks || []).map(normalizeTrack).filter(Boolean);
}

// ── Радио (Моя волна и станции) ───────────────────────────────────────────────

async function stations() {
  const result = await api('/rotor/stations/list');
  return (result || [])
    .map((entry) => {
      const station = entry.station || {};
      const id = station.id || {};
      if (!id.type || !id.tag) return null;
      return {
        id: `${id.type}:${id.tag}`,
        name: station.name || id.tag,
        color: (entry.settings && entry.settings.color) || station.icon?.backgroundColor || '#333',
      };
    })
    .filter(Boolean);
}

async function stationTracks(stationId, queueTrackId) {
  const result = await api(`/rotor/station/${stationId}/tracks`, {
    query: { settings2: true, queue: queueTrackId || undefined },
  });
  return {
    batchId: result.batchId || '',
    tracks: (result.sequence || []).map((item) => normalizeTrack(item.track)).filter(Boolean),
  };
}

// Ротору нужно сообщать о прослушивании, иначе волна перестаёт обновляться
async function stationFeedback(stationId, type, payload = {}) {
  const body = {
    type,
    timestamp: Date.now() / 1000,
    from: 'yamusic-proxy',
  };
  if (payload.trackId) body.trackId = payload.trackId;
  if (payload.totalPlayedSeconds != null) body.totalPlayedSeconds = payload.totalPlayedSeconds;
  const url = new URL(`${API_BASE}/rotor/station/${stationId}/feedback`);
  if (payload.batchId) url.searchParams.set('batch-id', payload.batchId);
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ── Прямая ссылка на аудио ────────────────────────────────────────────────────

function parseDownloadInfo(text) {
  try {
    const json = JSON.parse(text);
    if (json.host && json.path && json.ts && json.s) return json;
  } catch {
    // ниже разберём XML
  }
  const pick = (tag) => {
    const match = text.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
    return match ? match[1] : null;
  };
  const info = { host: pick('host'), path: pick('path'), ts: pick('ts'), s: pick('s') };
  if (!info.host || !info.path || !info.ts || !info.s) return null;
  return info;
}

const linkCache = new Map();

// Сервис живёт неделями — выкидываем протухшие ссылки, чтобы Map не разрасталась
function pruneLinkCache() {
  const now = Date.now();
  for (const [key, value] of linkCache) {
    if (value.expiresAt <= now) linkCache.delete(key);
  }
}

async function directLink(trackId, quality = config.defaultQuality) {
  const id = String(trackId).split(':')[0];
  const cacheKey = `${id}:${quality}`;
  const cached = linkCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;
  if (linkCache.size > 500) pruneLinkCache();

  const variants = await api(`/tracks/${id}/download-info`);
  if (!variants || !variants.length) {
    throw new YandexError('Трек недоступен для загрузки (нет подписки или региональное ограничение)', 403);
  }

  const mp3 = variants.filter((v) => v.codec === 'mp3');
  const list = (mp3.length ? mp3 : variants).slice().sort((a, b) => b.bitrateInKbps - a.bitrateInKbps);
  const chosen = quality === 'low' ? list[list.length - 1] : list[0];

  const res = await fetch(`${chosen.downloadInfoUrl}&format=json`, { headers: apiHeaders() });
  const info = parseDownloadInfo(await res.text());
  if (!info) throw new YandexError('Не удалось разобрать ответ download-info', 502);

  const sign = crypto
    .createHash('md5')
    .update(SIGN_SALT + info.path.slice(1) + info.s)
    .digest('hex');

  const link = {
    url: `https://${info.host}/get-mp3/${sign}/${info.ts}${info.path}`,
    codec: chosen.codec,
    bitrate: chosen.bitrateInKbps,
    expiresAt: Date.now() + LINK_TTL_MS,
  };
  linkCache.set(cacheKey, link);
  return link;
}

module.exports = {
  YandexError,
  accountStatus,
  currentUid,
  search,
  myPlaylists,
  playlistTracks,
  tracksByIds,
  likedTracks,
  albumTracks,
  artistTracks,
  stations,
  stationTracks,
  stationFeedback,
  directLink,
  coverUrl,
};
