const fs = require('fs');
const path = require('path');

// .env лежит рядом с сервером (server/.env), формат KEY=VALUE
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  port: num(process.env.PORT, 8080),
  host: process.env.HOST || '0.0.0.0',

  // Токен Яндекс Музыки живёт только на сервере, телефон его никогда не получает
  yandexToken: process.env.YANDEX_MUSIC_TOKEN || '',

  // Пароль, которым телефон логинится на наш прокси
  appPassword: process.env.APP_PASSWORD || '',
  authSecret: process.env.AUTH_SECRET || '',
  tokenTtlDays: num(process.env.TOKEN_TTL_DAYS, 90),

  // high — максимальный битрейт, low — минимальный (экономия мобильного трафика)
  defaultQuality: process.env.STREAM_QUALITY === 'low' ? 'low' : 'high',

  cacheEnabled: process.env.CACHE_ENABLED !== '0',
  cacheDir: process.env.CACHE_DIR || path.join(__dirname, '..', '.cache'),
  cacheMaxBytes: num(process.env.CACHE_MAX_MB, 4096) * 1024 * 1024,

  logRequests: process.env.LOG_REQUESTS !== '0',
};

function validateConfig() {
  const problems = [];
  if (!config.yandexToken) problems.push('YANDEX_MUSIC_TOKEN не задан — API Яндекс Музыки недоступен');
  if (!config.appPassword) problems.push('APP_PASSWORD не задан — вход с телефона невозможен');
  if (!config.authSecret) problems.push('AUTH_SECRET не задан — сессии телефона нельзя подписать');
  return problems;
}

module.exports = { config, validateConfig };
