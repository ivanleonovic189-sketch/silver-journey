/* Клиент Яндекс Музыки: весь трафик (API, обложки, аудио) идёт через свой сервер. */

const $ = (sel) => document.querySelector(sel);

const state = {
  token: localStorage.getItem('yamusic.token') || '',
  quality: localStorage.getItem('yamusic.quality') || 'high',
  view: 'search',
  detail: null, // {title, tracks} — открытый плейлист/альбом
  queue: [],
  index: -1,
  station: null, // {id, batchId} — активная волна
  shuffle: false,
  repeat: false,
  searchType: 'track',
};

const audio = new Audio();
audio.preload = 'auto';
// Держим элемент в DOM: часть мобильных браузеров иначе глушит фоновое воспроизведение
audio.hidden = true;
document.body.append(audio);

// ── Мелкие помощники ──────────────────────────────────────────────────────────

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function fmtTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function fmtSize(bytes) {
  if (!bytes) return '0 МБ';
  return `${(bytes / 1024 / 1024).toFixed(0)} МБ`;
}

let toastTimer = null;
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 3000);
}

function coverSrc(url, size = '200x200') {
  if (!url) return '';
  return `/api/cover?uri=${encodeURIComponent(url)}&size=${size}&t=${encodeURIComponent(state.token)}`;
}

function streamSrc(track) {
  return `/api/stream/${encodeURIComponent(track.id)}?q=${state.quality}&t=${encodeURIComponent(state.token)}`;
}

// ── Работа с API сервера ──────────────────────────────────────────────────────

async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${state.token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    logout();
    throw new Error('Сессия истекла, войдите заново');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка сервера (${res.status})`);
  return data;
}

// ── Вход и выход ──────────────────────────────────────────────────────────────

async function login(password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, device: navigator.userAgent.slice(0, 60) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Не удалось войти');
  state.token = data.token;
  localStorage.setItem('yamusic.token', data.token);
}

function logout() {
  state.token = '';
  localStorage.removeItem('yamusic.token');
  localStorage.removeItem('yamusic.queue');
  audio.pause();
  audio.removeAttribute('src');
  $('#app').classList.add('hidden');
  $('#player').classList.add('hidden');
  $('#settings').classList.add('hidden');
  $('#login').classList.remove('hidden');
}

// ── Навигация ─────────────────────────────────────────────────────────────────

const VIEW_TITLES = {
  search: 'Поиск',
  playlists: 'Плейлисты',
  likes: 'Любимое',
  radio: 'Волна',
};

function setView(view) {
  state.view = view;
  state.detail = null;
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.view === view);
  }
  $('#back-btn').classList.add('hidden');
  $('#view-title').textContent = VIEW_TITLES[view] || '';
  renderView();
}

function openDetail(title, tracks, subtitle) {
  state.detail = { title, tracks, subtitle };
  $('#back-btn').classList.remove('hidden');
  $('#view-title').textContent = title;
  history.pushState({ detail: true }, '');
  renderDetail();
}

function closeDetail() {
  state.detail = null;
  $('#back-btn').classList.add('hidden');
  $('#view-title').textContent = VIEW_TITLES[state.view] || '';
  renderView();
}

// ── Рендер списков ────────────────────────────────────────────────────────────

function trackRow(track, list, position) {
  const row = el('button', 'item');
  if (!track.available) row.classList.add('unavailable');
  if (currentTrack() && currentTrack().id === track.id) row.classList.add('playing');

  if (track.cover) {
    const img = el('img');
    img.loading = 'lazy';
    img.src = coverSrc(track.cover, '100x100');
    img.alt = '';
    row.append(img);
  } else {
    row.append(el('div', 'ph'));
  }

  const main = el('div', 'item-main');
  main.append(el('div', 'item-title', track.title), el('div', 'item-sub', track.artists));
  row.append(main, el('div', 'item-dur', fmtTime(track.durationMs / 1000)));

  row.addEventListener('click', () => {
    state.station = null;
    playQueue(list, position);
  });
  return row;
}

function renderTracks(container, tracks) {
  if (!tracks.length) {
    container.append(el('div', 'placeholder', 'Ничего не нашлось'));
    return;
  }
  const list = el('div', 'list');
  tracks.forEach((track, i) => list.append(trackRow(track, tracks, i)));
  container.append(list);
}

function renderDetail() {
  const content = $('#content');
  content.innerHTML = '';
  if (state.detail.subtitle) content.append(el('div', 'section-head', state.detail.subtitle));
  renderTracks(content, state.detail.tracks);
}

function loading(container) {
  container.innerHTML = '';
  container.append(el('div', 'placeholder', 'Загружаем…'));
}

function failed(container, err) {
  container.innerHTML = '';
  container.append(el('div', 'placeholder', err.message));
}

function renderView() {
  const content = $('#content');
  content.innerHTML = '';
  if (state.view === 'search') return renderSearch(content);
  if (state.view === 'playlists') return renderPlaylists(content);
  if (state.view === 'likes') return renderLikes(content);
  if (state.view === 'radio') return renderRadio(content);
  return undefined;
}

let searchTimer = null;
let lastQuery = '';

function renderSearch(content) {
  const bar = el('div', 'search-bar');
  const input = el('input');
  input.type = 'search';
  input.placeholder = 'Трек, альбом, исполнитель';
  input.value = lastQuery;
  bar.append(input);

  const chips = el('div', 'chips');
  const types = [
    ['track', 'Треки'],
    ['album', 'Альбомы'],
    ['artist', 'Исполнители'],
    ['playlist', 'Плейлисты'],
  ];
  for (const [value, label] of types) {
    const chip = el('button', `chip${state.searchType === value ? ' active' : ''}`, label);
    chip.addEventListener('click', () => {
      state.searchType = value;
      renderSearch(content);
      if (lastQuery) runSearch(lastQuery);
    });
    chips.append(chip);
  }

  const results = el('div');
  content.innerHTML = '';
  content.append(bar, chips, results);

  if (!lastQuery) results.append(el('div', 'placeholder', 'Что послушаем?'));
  else runSearch(lastQuery);

  input.addEventListener('input', () => {
    lastQuery = input.value.trim();
    clearTimeout(searchTimer);
    if (!lastQuery) {
      results.innerHTML = '';
      results.append(el('div', 'placeholder', 'Что послушаем?'));
      return;
    }
    searchTimer = setTimeout(() => runSearch(lastQuery), 400);
  });

  async function runSearch(query) {
    loading(results);
    try {
      const data = await api(`/api/search?q=${encodeURIComponent(query)}&type=${state.searchType}`);
      results.innerHTML = '';
      if (state.searchType === 'track') renderTracks(results, data.tracks || []);
      else if (state.searchType === 'album') renderAlbumGrid(results, data.albums || []);
      else if (state.searchType === 'artist') renderArtistGrid(results, data.artists || []);
      else renderPlaylistGrid(results, data.playlists || []);
    } catch (err) {
      failed(results, err);
    }
  }
}

function cardNode(cover, title, subtitle, onClick, placeholderChar) {
  const card = el('button', 'card');
  if (cover) {
    const img = el('img');
    img.loading = 'lazy';
    img.src = coverSrc(cover, '400x400');
    img.alt = '';
    card.append(img);
  } else {
    card.append(el('div', 'ph', placeholderChar || '♫'));
  }
  card.append(el('div', 'card-title', title));
  if (subtitle) card.append(el('div', 'card-sub', subtitle));
  card.addEventListener('click', onClick);
  return card;
}

function renderPlaylistGrid(container, playlists) {
  if (!playlists.length) {
    container.append(el('div', 'placeholder', 'Плейлистов нет'));
    return;
  }
  const grid = el('div', 'grid');
  for (const playlist of playlists) {
    grid.append(
      cardNode(playlist.cover, playlist.title, `${playlist.trackCount} треков`, async () => {
        try {
          toast('Открываем плейлист…');
          const data = await api(`/api/playlists/${playlist.kind}?uid=${encodeURIComponent(playlist.uid)}`);
          openDetail(playlist.title, data.tracks || [], `${(data.tracks || []).length} треков`);
        } catch (err) {
          toast(err.message);
        }
      }),
    );
  }
  container.append(grid);
}

function renderAlbumGrid(container, albums) {
  const grid = el('div', 'grid');
  for (const album of albums) {
    grid.append(
      cardNode(album.cover, album.title, album.artists, async () => {
        try {
          const data = await api(`/api/albums/${album.id}`);
          openDetail(album.title, data.tracks || [], album.artists);
        } catch (err) {
          toast(err.message);
        }
      }),
    );
  }
  container.append(grid);
}

function renderArtistGrid(container, artists) {
  const grid = el('div', 'grid');
  for (const artist of artists) {
    grid.append(
      cardNode(artist.cover, artist.name, 'Популярное', async () => {
        try {
          const data = await api(`/api/artists/${artist.id}/tracks`);
          openDetail(artist.name, data.tracks || [], 'Популярные треки');
        } catch (err) {
          toast(err.message);
        }
      }, '☺'),
    );
  }
  container.append(grid);
}

async function renderPlaylists(content) {
  loading(content);
  try {
    const data = await api('/api/playlists');
    content.innerHTML = '';
    renderPlaylistGrid(content, data.playlists || []);
  } catch (err) {
    failed(content, err);
  }
}

async function renderLikes(content) {
  loading(content);
  try {
    const data = await api('/api/likes');
    content.innerHTML = '';
    content.append(el('div', 'section-head', `${(data.tracks || []).length} треков`));
    renderTracks(content, data.tracks || []);
  } catch (err) {
    failed(content, err);
  }
}

async function renderRadio(content) {
  loading(content);
  try {
    const data = await api('/api/stations');
    content.innerHTML = '';
    const grid = el('div', 'grid');
    for (const station of data.stations || []) {
      const card = el('button', 'station', station.name);
      card.style.background = station.color || '#2a2a34';
      card.addEventListener('click', () => startStation(station));
      grid.append(card);
    }
    content.append(grid);
  } catch (err) {
    failed(content, err);
  }
}

// ── Радио ─────────────────────────────────────────────────────────────────────

async function startStation(station) {
  try {
    toast(`Включаем «${station.name}»`);
    const data = await api(`/api/stations/${encodeURIComponent(station.id)}/tracks`);
    if (!data.tracks || !data.tracks.length) throw new Error('Станция не отдала треки');
    state.station = { id: station.id, batchId: data.batchId, name: station.name };
    api(`/api/stations/${encodeURIComponent(station.id)}/feedback`, {
      method: 'POST',
      body: { type: 'radioStarted', batchId: data.batchId },
    }).catch(() => {});
    playQueue(data.tracks, 0);
  } catch (err) {
    toast(err.message);
  }
}

async function extendStation() {
  if (!state.station) return;
  const last = state.queue[state.queue.length - 1];
  try {
    const data = await api(
      `/api/stations/${encodeURIComponent(state.station.id)}/tracks?queue=${encodeURIComponent(last ? last.id : '')}`,
    );
    const fresh = (data.tracks || []).filter((t) => !state.queue.some((q) => q.id === t.id));
    if (fresh.length) {
      state.queue.push(...fresh);
      state.station.batchId = data.batchId;
      saveQueue();
    }
  } catch {
    // волна докачается на следующем треке
  }
}

// ── Плеер ─────────────────────────────────────────────────────────────────────

function currentTrack() {
  return state.index >= 0 ? state.queue[state.index] : null;
}

function saveQueue() {
  try {
    localStorage.setItem(
      'yamusic.queue',
      JSON.stringify({ queue: state.queue.slice(0, 500), index: state.index, station: state.station }),
    );
  } catch {
    // приватный режим — переживём
  }
}

function restoreQueue() {
  try {
    const saved = JSON.parse(localStorage.getItem('yamusic.queue') || 'null');
    if (!saved || !Array.isArray(saved.queue) || !saved.queue.length) return;
    state.queue = saved.queue;
    state.index = Math.min(Math.max(saved.index, 0), saved.queue.length - 1);
    state.station = saved.station || null;
    const track = currentTrack();
    if (track) {
      audio.src = streamSrc(track);
      updatePlayerUi(track);
      $('#mini').classList.remove('hidden');
    }
  } catch {
    // битые данные — просто начинаем с чистого листа
  }
}

function playQueue(tracks, index) {
  state.queue = tracks.filter((t) => t.available !== false);
  const target = tracks[index];
  state.index = Math.max(0, state.queue.findIndex((t) => t.id === (target && target.id)));
  playCurrent();
}

function playCurrent() {
  const track = currentTrack();
  if (!track) return;
  audio.src = streamSrc(track);
  audio.play().catch((err) => toast(`Не удалось начать: ${err.message}`));
  updatePlayerUi(track);
  $('#mini').classList.remove('hidden');
  saveQueue();
  renderNowPlayingHighlight();

  if (state.station) {
    api(`/api/stations/${encodeURIComponent(state.station.id)}/feedback`, {
      method: 'POST',
      body: { type: 'trackStarted', trackId: track.id, batchId: state.station.batchId },
    }).catch(() => {});
    if (state.index >= state.queue.length - 2) extendStation();
  }
}

function togglePlay() {
  if (!currentTrack()) return;
  if (audio.paused) audio.play().catch((err) => toast(err.message));
  else audio.pause();
}

function nextTrack(auto = false) {
  if (!state.queue.length) return;
  if (state.repeat && auto) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  if (state.shuffle) {
    state.index = Math.floor(Math.random() * state.queue.length);
  } else if (state.index < state.queue.length - 1) {
    state.index += 1;
  } else if (state.station) {
    extendStation().then(() => {
      if (state.index < state.queue.length - 1) {
        state.index += 1;
        playCurrent();
      }
    });
    return;
  } else {
    state.index = 0;
    if (auto) {
      audio.pause();
      return;
    }
  }
  playCurrent();
}

function prevTrack() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  state.index = state.index > 0 ? state.index - 1 : state.queue.length - 1;
  playCurrent();
}

function updatePlayerUi(track) {
  const cover = coverSrc(track.cover, '400x400');
  $('#mini-title').textContent = track.title;
  $('#mini-artist').textContent = track.artists;
  $('#mini-cover').src = cover;
  $('#player-title').textContent = track.title;
  $('#player-artist').textContent = track.artists;
  $('#player-cover').src = cover;
  $('#time-total').textContent = fmtTime(track.durationMs / 1000);
  document.title = `${track.title} — ${track.artists}`;
  updateMediaSession(track, cover);
}

function updateMediaSession(track, cover) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artists,
    album: track.album || '',
    artwork: cover ? [{ src: cover, sizes: '400x400', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.setActionHandler('play', () => audio.play());
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
  navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) audio.currentTime = details.seekTime;
  });
}

function renderNowPlayingHighlight() {
  const track = currentTrack();
  if (!track) return;
  document.querySelectorAll('.item').forEach((row) => {
    const title = row.querySelector('.item-title');
    row.classList.toggle('playing', Boolean(title) && title.textContent === track.title);
  });
}

function reflectPlayState() {
  const icon = audio.paused ? '▶' : '⏸';
  $('#mini-play').textContent = icon;
  $('#ctl-play').textContent = icon;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  }
}

let seeking = false;

audio.addEventListener('play', reflectPlayState);
audio.addEventListener('pause', reflectPlayState);
audio.addEventListener('ended', () => nextTrack(true));
audio.addEventListener('error', () => {
  if (!audio.src) return;
  toast('Трек не проигрывается, пропускаем');
  setTimeout(() => nextTrack(true), 800);
});
audio.addEventListener('timeupdate', () => {
  const duration = audio.duration || (currentTrack() ? currentTrack().durationMs / 1000 : 0);
  if (!duration) return;
  const ratio = audio.currentTime / duration;
  $('#mini-progress').style.width = `${Math.min(100, ratio * 100)}%`;
  $('#time-now').textContent = fmtTime(audio.currentTime);
  if (!seeking) $('#seek').value = String(Math.floor(ratio * 1000));
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && Number.isFinite(audio.duration)) {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      position: audio.currentTime,
      playbackRate: audio.playbackRate,
    });
  }
});
audio.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(audio.duration)) $('#time-total').textContent = fmtTime(audio.duration);
});

// ── Экраны плеера и настроек ──────────────────────────────────────────────────

function openPlayer() {
  if (!currentTrack()) return;
  $('#player').classList.remove('hidden');
  $('#player-source').textContent = state.station ? `Волна: ${state.station.name}` : '';
  history.pushState({ player: true }, '');
}

function closePlayer(fromHistory) {
  $('#player').classList.add('hidden');
  if (!fromHistory) history.back();
}

async function openSettings() {
  $('#settings').classList.remove('hidden');
  history.pushState({ settings: true }, '');
  $('#set-quality').value = state.quality;
  try {
    const account = await api('/api/account');
    $('#set-account').textContent = `${account.displayName || account.login}${account.hasPlus ? ' · Плюс' : ''}`;
  } catch (err) {
    $('#set-account').textContent = err.message;
  }
  try {
    const stats = await api('/api/cache');
    $('#set-cache').textContent = stats.enabled
      ? `${stats.tracks} треков, ${fmtSize(stats.bytes)} из ${fmtSize(stats.limitBytes)}`
      : 'выключен';
  } catch {
    $('#set-cache').textContent = 'недоступен';
  }
}

function closeSettings(fromHistory) {
  $('#settings').classList.add('hidden');
  if (!fromHistory) history.back();
}

// ── Подписки на события интерфейса ────────────────────────────────────────────

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = $('#login-error');
  error.classList.add('hidden');
  try {
    await login($('#login-password').value);
    $('#login').classList.add('hidden');
    start();
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove('hidden');
  }
});

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => setView(tab.dataset.view));
}

$('#back-btn').addEventListener('click', () => history.back());
$('#settings-btn').addEventListener('click', openSettings);
$('#settings-close').addEventListener('click', () => closeSettings());
$('#player-close').addEventListener('click', () => closePlayer());

$('#mini').addEventListener('click', (event) => {
  if (event.target.closest('#mini-play') || event.target.closest('#mini-next')) return;
  openPlayer();
});
$('#mini-play').addEventListener('click', togglePlay);
$('#mini-next').addEventListener('click', () => nextTrack());
$('#ctl-play').addEventListener('click', togglePlay);
$('#ctl-next').addEventListener('click', () => nextTrack());
$('#ctl-prev').addEventListener('click', prevTrack);

$('#ctl-shuffle').addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  $('#ctl-shuffle').classList.toggle('active', state.shuffle);
  toast(state.shuffle ? 'Перемешивание включено' : 'Перемешивание выключено');
});
$('#ctl-repeat').addEventListener('click', () => {
  state.repeat = !state.repeat;
  $('#ctl-repeat').classList.toggle('active', state.repeat);
  toast(state.repeat ? 'Повтор трека' : 'Повтор выключен');
});

$('#seek').addEventListener('input', () => {
  seeking = true;
  const duration = audio.duration || 0;
  if (duration) $('#time-now').textContent = fmtTime((Number($('#seek').value) / 1000) * duration);
});
$('#seek').addEventListener('change', () => {
  const duration = audio.duration || 0;
  if (duration) audio.currentTime = (Number($('#seek').value) / 1000) * duration;
  seeking = false;
});

$('#set-quality').addEventListener('change', (event) => {
  state.quality = event.target.value;
  localStorage.setItem('yamusic.quality', state.quality);
  const track = currentTrack();
  if (track) {
    // Меняем битрейт без потери позиции в треке
    const position = audio.currentTime;
    const wasPlaying = !audio.paused;
    audio.src = streamSrc(track);
    audio.addEventListener('loadedmetadata', function seek() {
      audio.removeEventListener('loadedmetadata', seek);
      audio.currentTime = position;
      if (wasPlaying) audio.play().catch(() => {});
    });
  }
  toast(`Качество: ${state.quality === 'low' ? 'низкое' : 'высокое'}`);
});

$('#set-cache-clear').addEventListener('click', async () => {
  try {
    const data = await api('/api/cache', { method: 'DELETE' });
    toast(`Удалено треков: ${data.removed}`);
    $('#set-cache').textContent = '0 треков';
  } catch (err) {
    toast(err.message);
  }
});

$('#set-logout').addEventListener('click', logout);

window.addEventListener('popstate', () => {
  if (!$('#settings').classList.contains('hidden')) return closeSettings(true);
  if (!$('#player').classList.contains('hidden')) return closePlayer(true);
  if (state.detail) return closeDetail();
  return undefined;
});

// ── Запуск ────────────────────────────────────────────────────────────────────

function start() {
  $('#app').classList.remove('hidden');
  setView('search');
  restoreQueue();
  reflectPlayState();
}

if (state.token) start();
else $('#login').classList.remove('hidden');

if ('serviceWorker' in navigator) {
  // Service worker работает только по HTTPS или на localhost — без него приложение тоже живое
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
