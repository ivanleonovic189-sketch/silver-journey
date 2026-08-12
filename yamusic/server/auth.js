const crypto = require('crypto');
const { config } = require('./config');

// Сессия телефона: подписанный HMAC-токен, состояния на сервере не держим
function createAuthToken(deviceName) {
  const payload = JSON.stringify({
    device: String(deviceName || 'phone').slice(0, 64),
    iat: Date.now(),
    exp: Date.now() + config.tokenTtlDays * 24 * 60 * 60 * 1000,
  });
  const body = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function parseAuthToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Пароль сравниваем по хэшу, чтобы длина строки не утекала через тайминг
function checkPassword(given) {
  if (!config.appPassword || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(config.appPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

// Токен приходит либо заголовком (fetch), либо в query — <audio src> заголовки слать не умеет
function tokenFromRequest(req, url) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return url.searchParams.get('t') || '';
}

module.exports = { createAuthToken, parseAuthToken, checkPassword, tokenFromRequest };
