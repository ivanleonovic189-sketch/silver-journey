const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  initDb,
  getDb,
  saveDb,
  saveDbAsync,
  nextId,
  ensureDbReady,
  reloadDbFromBlob,
  isServerless,
} = require('./db');
const { createAuthToken, parseAuthToken } = require('./auth-token');

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

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isNetlify = /^https:\/\/[\w-]+\.netlify\.app$/.test(origin);
    const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (isLocal || isNetlify || extraOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
}));
app.use(express.json());

// Netlify Function: путь приходит как /auth/... вместо /api/auth/...
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use((req, res, next) => {
    const qIndex = req.url.indexOf('?');
    const pathname = qIndex === -1 ? req.url : req.url.slice(0, qIndex);
    const query = qIndex === -1 ? '' : req.url.slice(qIndex);
    if (!pathname.startsWith('/api')) {
      req.url = `/api${pathname}${query}`;
    }
    next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'enter-pay-api' });
});

if (!isServerless) {
  initDb();
}

if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.use(async (req, res, next) => {
    try {
      await ensureDbReady();
      await reloadDbFromBlob();
      next();
    } catch (err) {
      console.error('DB init error:', err);
      res.status(500).json({ error: 'Database unavailable' });
    }
  });
}

// ========== АВТОРИЗАЦИЯ ==========

function resolveUserFromToken(token) {
  const jwt = parseAuthToken(token);
  if (jwt?.user) {
    const db = getDb();
    const dbUser = db.users?.find(
      (u) =>
        String(u.id) === String(jwt.user.id) &&
        String(u.email || '').toLowerCase() === String(jwt.user.email || '').toLowerCase()
    );
    if (dbUser) {
      const { password, ...safe } = dbUser;
      return safe;
    }
    return null;
  }

  const db = getDb();
  const session = db.sessions?.find((s) => s.token === token && s.expiresAt > new Date().toISOString());
  if (!session) return null;
  const user = db.users?.find((u) => u.id === session.userId);
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function resolveUserFromApiKey(db, apiKey) {
  if (!apiKey || !String(apiKey).startsWith('merchant_')) return null;
  initMerchants(db);
  const merchant = (db.merchants || []).find(
    (m) => m.apiKey === apiKey && m.enabled !== false
  );
  if (!merchant?.userId) return null;
  const dbUser = findDbUser(db, merchant.userId);
  if (!dbUser) return null;
  const { password, ...safe } = dbUser;
  return safe;
}

function checkApiIpWhitelist(dbUser, req) {
  const settings = normalizeShopSettings(dbUser.settings);
  const whitelist = String(settings.apiIpWhitelist || '').trim();
  if (!whitelist) return true;
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0] || '')
    .trim() || req.ip || req.socket?.remoteAddress || '';
  const allowed = whitelist.split(/[\s,;]+/).filter(Boolean);
  return allowed.some((ip) => clientIp === ip || clientIp.endsWith(ip));
}

// Middleware для проверки авторизации (JWT сессия или API Key магазина)
function requireAuth(req, res, next) {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  let user = resolveUserFromToken(token);
  req.authViaApiKey = false;
  if (!user) {
    const db = getDb();
    user = resolveUserFromApiKey(db, token);
    if (user) {
      req.authViaApiKey = true;
      const dbUser = findDbUser(db, user.id);
      if (dbUser && !checkApiIpWhitelist(dbUser, req)) {
        return res.status(403).json({ error: 'IP-адрес не в whitelist API' });
      }
    }
  }
  if (!user) {
    return res.status(401).json({ error: 'Недействительный токен или API Key' });
  }

  req.user = user;
  next();
}

function findDbUser(db, userId) {
  return (db.users || []).find((us) => String(us.id) === String(userId));
}

// TEMPORARY: set SHOP_VERIFICATION_ENABLED=true to require shop confirmation again
const SHOP_VERIFICATION_ENABLED = process.env.SHOP_VERIFICATION_ENABLED === 'true';

function generateVerificationCode() {
  return `EP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function isShopVerified(user) {
  if (!user || user.role !== 'shop') return true;
  if (!SHOP_VERIFICATION_ENABLED) return true;
  return user.verified === true;
}

function ensureShopVerificationFields(db, user) {
  if (!user || user.role !== 'shop') return user;
  const dbUser = findDbUser(db, user.id);
  if (!dbUser) return user;

  let changed = false;
  if (dbUser.verified !== true && dbUser.verified !== false) {
    dbUser.verified = false;
    changed = true;
  }
  if (!dbUser.verified && !dbUser.verificationCode) {
    dbUser.verificationCode = generateVerificationCode();
    changed = true;
  }
  if (changed) saveDb(db);
  return dbUser;
}

function shopVerificationPayload(user) {
  if (!user || user.role !== 'shop') return null;
  return {
    verified: isShopVerified(user),
    code: user.verified ? null : user.verificationCode || null,
  };
}

function buildReferralCodeFromName(name) {
  const code = String(name || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-ZА-ЯЁ0-9]/gi, '');
  return code || null;
}

function assignReferralCode(db, name, excludeUserId) {
  let base = buildReferralCodeFromName(name);
  if (!base) base = 'USER';
  let candidate = base;
  let n = 1;
  while (
    db.users.some(
      (u) =>
        u.id !== excludeUserId &&
        u.referralCode &&
        u.referralCode.toUpperCase() === candidate.toUpperCase()
    )
  ) {
    candidate = `${base}${n++}`;
  }
  return candidate;
}

function ensureUserReferralCode(db, user) {
  if (!user || user.role !== 'merchant') return null;
  const u = db.users.find((us) => us.id === user.id);
  if (!u) return null;
  if (!u.referralCode) {
    u.referralCode = assignReferralCode(db, u.name, u.id);
    saveDb(db);
  }
  return u.referralCode;
}

// Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
  await ensureDbReady();
  const db = isServerless ? await reloadDbFromBlob() : getDb();
  const { email, password, name, telegram, role, referralCode } = req.body || {};
  
  if (!email || !password || !name || !telegram || !role) {
    return res.status(400).json({ error: 'Укажите email, password, name, telegram и role' });
  }
  
  if (role !== 'merchant' && role !== 'shop') {
    return res.status(400).json({ error: 'Роль должна быть "merchant" или "shop"' });
  }
  
  if (!Array.isArray(db.users)) db.users = [];
  
  const emailNorm = String(email).toLowerCase().trim();
  if (db.users.find(u => u.email === emailNorm)) {
    return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
  }

  let referrerId = null;
  if (referralCode && String(referralCode).trim()) {
    const referrer = db.users.find(u => u.referralCode && u.referralCode.toUpperCase() === String(referralCode).trim().toUpperCase());
    if (referrer && referrer.id) referrerId = referrer.id;
  }
  
  const user = {
    id: nextId(db.users),
    email: emailNorm,
    password: crypto.createHash('sha256').update(String(password)).digest('hex'),
    name: String(name),
    telegram: String(telegram).trim(),
    role: String(role),
    referralCode: role === 'merchant' ? assignReferralCode(db, name, null) : null,
    referrerId: referrerId,
    createdAt: new Date().toISOString(),
    verified: role === 'shop' ? (SHOP_VERIFICATION_ENABLED ? false : true) : true,
    verificationCode: role === 'shop' && SHOP_VERIFICATION_ENABLED ? generateVerificationCode() : null,
  };
  
  db.users.push(user);
  
  initMerchants(db);
  if (role === 'merchant' || role === 'shop') {
    const existingMerchant = db.merchants.find(m => String(m.userId) === String(user.id));
    if (!existingMerchant) {
      db.merchants.push({
        id: nextId(db.merchants),
        name: role === 'shop' ? `${name} (казино)` : `${name} (мерчант)`,
        apiKey: 'merchant_' + crypto.randomBytes(16).toString('hex'),
        balance: 0,
        enabled: true,
        userId: user.id,
        createdAt: new Date().toISOString(),
      });
    }
  }
  
  await saveDbAsync(db);

  const { password: _, ...userPublic } = user;
  if (role === 'shop' && SHOP_VERIFICATION_ENABLED) {
    userPublic.verified = false;
    userPublic.verificationCode = user.verificationCode;
  }
  const token = createAuthToken(userPublic);
  res.status(201).json({
    user: userPublic,
    token,
    verification: shopVerificationPayload(user),
  });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ ok: false });
  }
});

// Логин
app.post('/api/auth/login', async (req, res) => {
  try {
  await ensureDbReady();
  const db = isServerless ? await reloadDbFromBlob() : getDb();
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и password' });
  }
  
  if (!Array.isArray(db.users)) db.users = [];
  const emailNorm = String(email).toLowerCase().trim();
  let user = db.users.find(u => u.email === emailNorm);
  
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  
  const passwordHash = crypto.createHash('sha256').update(String(password)).digest('hex');
  if (user.password !== passwordHash) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  if (user.role === 'shop') {
    ensureShopMerchant(db, user);
    user = ensureShopVerificationFields(db, user);
  }

  const { password: _, ...userPublic } = user;
  const token = createAuthToken(userPublic);
  res.json({
    user: userPublic,
    token,
    verification: shopVerificationPayload(user),
  });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ ok: false });
  }
});

// Получить текущего пользователя
app.get('/api/auth/me', requireAuth, (req, res) => {
  const db = getDb();
  if (req.user.role === 'shop') {
    ensureShopMerchant(db, req.user);
  }
  let u = findDbUser(db, req.user.id) || req.user;
  if (u.role === 'shop') {
    u = ensureShopVerificationFields(db, u);
  }
  const { password: _, ...userPublic } = u;
  res.json({
    user: userPublic,
    verification: shopVerificationPayload(u),
  });
});

// Реферальная программа
app.get('/api/referral', requireAuth, (req, res) => {
  const db = getDb();
  if (req.user.role !== 'merchant') {
    return res.status(403).json({ error: 'Реферальная программа недоступна' });
  }
  const code = ensureUserReferralCode(db, req.user);
  const baseUrl = process.env.FRONTEND_URL || 'https://enterpay.netlify.app';
  const referralLink = code ? `${baseUrl}#ref=${encodeURIComponent(code)}` : null;
  res.json({
    referralLink,
    referralCode: code,
    displayName: req.user.name,
  });
});

// Устарело: код задаётся автоматически по нику
app.patch('/api/referral/set-code', requireAuth, (_req, res) => {
  res.status(410).json({ error: 'Реферальный код формируется автоматически по вашему нику' });
});

// Выход (JWT stateless, клиент удаляет токен)
app.post('/api/auth/logout', requireAuth, (_req, res) => {
  res.json({ success: true });
});

// Подтверждение магазина по коду (публичная ссылка /acceptcodeEP-XXXX)
async function verifyShopByCode(db, rawCode) {
  const codeNorm = String(rawCode || '').trim().toUpperCase();
  if (!codeNorm) return null;
  const u = (db.users || []).find(
    (us) => us.role === 'shop' && String(us.verificationCode || '').toUpperCase() === codeNorm
  );
  if (!u) return null;
  if (u.verified === true) {
    return { user: u, already: true };
  }
  u.verified = true;
  u.verifiedAt = new Date().toISOString();
  await saveDbAsync(db);
  return { user: u, already: false };
}

app.get('/api/acceptcode/:code', async (req, res) => {
  try {
    await ensureDbReady();
    const db = isServerless ? await reloadDbFromBlob() : getDb();
    const result = await verifyShopByCode(db, req.params.code);
    if (!result) {
      return res.status(404).json({ ok: false });
    }
    const { user: u, already } = result;
    res.json({
      ok: true,
      already,
      userId: u.id,
      email: u.email,
      name: u.name,
      verified: true,
    });
  } catch (err) {
    console.error('Accept code error:', err);
    res.status(500).json({ ok: false });
  }
});

// Подтверждение аккаунта казино (админ / вручную через секрет)
app.post('/api/admin/verify-user', async (req, res) => {
  const adminSecret = process.env.ADMIN_VERIFY_SECRET;
  if (!adminSecret) {
    return res.status(503).json({ error: 'ADMIN_VERIFY_SECRET не настроен на сервере' });
  }
  const hdr = req.headers['x-admin-secret'] || req.body?.secret;
  if (hdr !== adminSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const db = getDb();
  const { userId, email, verificationCode } = req.body || {};
  let u = null;
  if (userId != null) {
    u = findDbUser(db, userId);
  } else if (email) {
    const emailNorm = String(email).toLowerCase().trim();
    u = (db.users || []).find((us) => us.email === emailNorm);
  } else if (verificationCode) {
    await ensureDbReady();
    const dbReloaded = isServerless ? await reloadDbFromBlob() : getDb();
    const result = await verifyShopByCode(dbReloaded, verificationCode);
    if (result) u = result.user;
  }
  if (!u) return res.status(404).json({ ok: false });
  if (u.role !== 'shop') {
    return res.status(400).json({ ok: false });
  }
  if (!u.verified) {
    u.verified = true;
    u.verifiedAt = new Date().toISOString();
    await saveDbAsync(db);
  }
  res.json({
    ok: true,
    userId: u.id,
    email: u.email,
    name: u.name,
    verified: true,
  });
});

// ========== НАСТРОЙКИ (паблишер / казино) ==========

const DEFAULT_PUBLISHER_SETTINGS = {
  shopSetupComplete: false,
  shopName: '',
  paymentMethodsNeeded: [],
  casinoSiteUrl: '',
  landingPageUrl: '',
  defaultSubId: '',
  trackingSource: '',
  trafficGeo: 'RU,CIS',
  postbackUrl: '',
  postbackDeposit: true,
  postbackFirstDeposit: true,
  postbackWithdraw: false,
  postbackChargeback: true,
  postbackSecret: '',
  notifyTelegramDeposits: true,
  notifyTelegramPayouts: true,
  notifyTelegramAppeals: true,
  notifyMinAmount: 1000,
  apiIpWhitelist: '',
  integrationMethod: 'h2h',
  autoAcceptPayouts: false,
  holdPeriodHours: 0,
  revshareDisplay: true,
};

const SHOP_PAYMENT_METHODS = ['sbp', 'card_ru'];

function normalizeShopSettings(settings) {
  const merged = { ...DEFAULT_PUBLISHER_SETTINGS, ...(settings || {}) };
  if (!Array.isArray(merged.paymentMethodsNeeded)) {
    merged.paymentMethodsNeeded = [];
  }
  merged.paymentMethodsNeeded = merged.paymentMethodsNeeded.filter((m) =>
    SHOP_PAYMENT_METHODS.includes(m)
  );
  merged.shopName = String(merged.shopName || '').trim().slice(0, 80);
  if (!['h2h', 'p2p'].includes(merged.integrationMethod)) {
    merged.integrationMethod = 'h2h';
  }
  if (merged.shopName && merged.paymentMethodsNeeded.length > 0) {
    merged.shopSetupComplete = true;
  }
  return merged;
}

function applyShopSetupToMerchant(db, user, settings) {
  if (!user || user.role !== 'shop' || !settings.shopSetupComplete) return;
  ensureShopMerchant(db, user);
  const merchant = getUserMerchant(db, user.id);
  if (merchant && settings.shopName) {
    merchant.name = `${settings.shopName} (магазин)`;
  }
  if (settings.shopName && user.name !== settings.shopName) {
    user.name = settings.shopName;
  }
  if (merchant && settings.casinoSiteUrl) {
    merchant.siteUrl = String(settings.casinoSiteUrl).trim().slice(0, 256);
  }
}

app.get('/api/settings', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  const u = findDbUser(db, req.user.id) || req.user;
  const merchant = (db.merchants || []).find(m => String(m.userId) === String(u.id));
  const settings = normalizeShopSettings(u.settings);
  res.json({
    settings,
    profile: {
      id: u.id,
      name: u.name,
      email: u.email,
      telegram: u.telegram,
      role: u.role,
    },
    integration: merchant
      ? { merchantId: merchant.id, apiKey: merchant.apiKey, enabled: merchant.enabled !== false }
      : null,
  });
});

app.patch('/api/settings', requireAuth, (req, res) => {
  const db = getDb();
  let u = findDbUser(db, req.user.id);
  if (!u) {
    return res.status(404).json({ error: 'Пользователь не найден. Выйдите и войдите снова.' });
  }

  const { settings, profile } = req.body || {};

  if (profile && typeof profile === 'object') {
    if (profile.name != null) u.name = String(profile.name).trim().slice(0, 80);
    if (profile.telegram != null) u.telegram = String(profile.telegram).trim().slice(0, 64);
  }

  if (settings && typeof settings === 'object') {
    const merged = normalizeShopSettings({ ...(u.settings || {}), ...settings });

    if (Array.isArray(settings.paymentMethodsNeeded)) {
      merged.paymentMethodsNeeded = settings.paymentMethodsNeeded.filter((m) =>
        SHOP_PAYMENT_METHODS.includes(m)
      );
    }
    if (settings.shopName != null) {
      merged.shopName = String(settings.shopName).trim().slice(0, 80);
    }
    if (settings.casinoSiteUrl != null) {
      merged.casinoSiteUrl = String(settings.casinoSiteUrl).trim().slice(0, 256);
    }

    const allowed = Object.keys(DEFAULT_PUBLISHER_SETTINGS);
    for (const key of allowed) {
      if (['shopName', 'paymentMethodsNeeded', 'shopSetupComplete', 'casinoSiteUrl'].includes(key)) {
        continue;
      }
      if (settings[key] !== undefined) {
        merged[key] = settings[key];
      }
    }
    if (typeof merged.notifyMinAmount === 'string') {
      merged.notifyMinAmount = parseInt(merged.notifyMinAmount, 10) || 0;
    }
    if (typeof merged.holdPeriodHours === 'string') {
      merged.holdPeriodHours = parseInt(merged.holdPeriodHours, 10) || 0;
    }
    merged.notifyMinAmount = Math.max(0, Number(merged.notifyMinAmount) || 0);
    merged.holdPeriodHours = Math.max(0, Math.min(168, Number(merged.holdPeriodHours) || 0));
    if (u.role === 'shop') {
      if (merged.shopName && merged.paymentMethodsNeeded.length > 0) {
        merged.shopSetupComplete = true;
      }
      try {
        applyShopSetupToMerchant(db, u, merged);
      } catch (err) {
        console.error('applyShopSetupToMerchant error:', err);
      }
    }
    u.settings = normalizeShopSettings(merged);
  }

  saveDb(db);
  const { password: __, ...userPublic } = u;
  res.json({
    settings: u.settings,
    profile: {
      id: userPublic.id,
      name: userPublic.name,
      email: userPublic.email,
      telegram: userPublic.telegram,
      role: userPublic.role,
    },
  });
});

// ========== МЕРЧАНТЫ ==========

function getUserMerchant(db, userId) {
  initMerchants(db);
  return (db.merchants || []).find((m) => String(m.userId) === String(userId));
}

function getUserTransactions(db, userId) {
  const merchant = getUserMerchant(db, userId);
  if (!merchant) return [];
  return (db.transactions || []).filter((t) => String(t.merchantId) === String(merchant.id));
}

// Получить список мерчантов
app.get('/api/merchants', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  const merchants = (db.merchants || []).filter((m) => String(m.userId) === String(req.user.id));
  res.json(merchants.map(m => {
    const { apiKey, ...publicMerchant } = m;
        return publicMerchant;
      }));
});

// Создать мерчанта
app.post('/api/merchants', requireAuth, (req, res) => {
  const db = getDb();
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Укажите name' });
  
  const merchant = {
    id: nextId(db.merchants || []),
    name: String(name),
    apiKey: 'merchant_' + crypto.randomBytes(16).toString('hex'),
    balance: 0,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  
  if (!Array.isArray(db.merchants)) db.merchants = [];
  db.merchants.push(merchant);
  saveDb(db);
  
  res.status(201).json(merchant);
});

// Получить мерчанта по ID
app.get('/api/merchants/:id', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
  
  const merchant = db.merchants.find(m => m.id === id);
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  
  const { apiKey, ...publicMerchant } = merchant;
  res.json(publicMerchant);
});

// Депозит на счет мерчанта (мерчант сам пополняет свой баланс)
app.post('/api/merchants/:id/deposit', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  const id = parseInt(req.params.id, 10);
  const { amount, paymentMethod } = req.body || {};
  
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите amount > 0' });
  
  const merchant = db.merchants.find(m => m.id === id);
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  if (!merchant.enabled) return res.status(400).json({ error: 'Мерчант отключен' });
  
  merchant.balance = (merchant.balance || 0) + Number(amount);
  
  const depositAmount = Number(amount);
  const transaction = {
    id: nextId(db.transactions || []),
    merchantId: String(id),
    type: 'merchant_deposit',
    amount: Number(amount),
    currency: '₽',
    paymentMethod: paymentMethod || 'manual',
    status: 'completed',
    createdAt: new Date().toISOString(),
    metadata: { description: 'Депозит на счет мерчанта' },
  };
  
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(transaction);
  
  // Реферальная программа: 0.5% от пополнения идёт пригласившему
  const REFERRAL_PERCENT = 0.5;
  const merchantUserId = merchant.userId ?? (id === 1 ? 1 : null);
  if (merchantUserId) {
    const referredUser = db.users.find(u => u.id === merchantUserId);
    if (referredUser && referredUser.referrerId) {
      const referrer = db.users.find(u => u.id === referredUser.referrerId);
      if (referrer) {
        const rewardAmount = Math.round(depositAmount * (REFERRAL_PERCENT / 100));
        if (rewardAmount > 0) {
          const referrerMerchant = db.merchants.find(m => String(m.userId) === String(referrer.id));
          if (referrerMerchant) {
            referrerMerchant.balance = (referrerMerchant.balance || 0) + rewardAmount;
          }
          db.transactions.push({
            id: nextId(db.transactions),
            type: 'referral_reward',
            userId: String(referrer.id),
            referrerId: String(referrer.id),
            referredUserId: String(referredUser.id),
            amount: rewardAmount,
            baseAmount: depositAmount,
            sourceType: 'merchant_deposit',
            sourceTransactionId: transaction.id,
            currency: '₽',
            status: 'completed',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }
  
  saveDb(db);
  
  const { apiKey, ...publicMerchant } = merchant;
  res.json({ merchant: publicMerchant, transaction });
});

// ========== ПЛАТЕЖИ ЧЕРЕЗ МЕРЧАНТОВ ==========

// Инициализация методов оплаты (только СБП и карта РФ для мерчантов)
function initPaymentMethods(db) {
  if (!Array.isArray(db.paymentMethods) || db.paymentMethods.length === 0) {
    db.paymentMethods = [
      { id: 'card_ru', name: 'Банковская карта РФ', type: 'card', enabled: true, fee: 2.5, min: 100, max: 500000 },
      { id: 'sbp', name: 'СБП (Система быстрых платежей)', type: 'bank', enabled: true, fee: 0.5, min: 10, max: 100000 },
    ];
    saveDb(db);
  }
}

// Инициализация тестового мерчанта
function initMerchants(db) {
  if (!Array.isArray(db.merchants)) db.merchants = [];
  const m1 = db.merchants.find(m => m.id === 1);
  if (m1 && m1.userId == null) { m1.userId = 1; saveDb(db); }
  if (!isServerless && db.merchants.length === 0) {
    db.merchants = [
      {
        id: 1,
        name: 'Тестовый мерчант',
        apiKey: 'test_merchant_key_' + crypto.randomBytes(16).toString('hex'),
        balance: 0,
        enabled: true,
        userId: 1,
        createdAt: new Date().toISOString(),
      },
    ];
    saveDb(db);
  }
}

// Получить список методов оплаты (только СБП и карта РФ)
app.get('/api/payment-methods', requireAuth, (req, res) => {
  const db = getDb();
  initPaymentMethods(db);
  res.json(db.paymentMethods.filter(m => m.enabled));
});

// Создать транзакцию депозита (пользователь пополняет через мерчанта)
app.post('/api/transactions/deposit', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  initPaymentMethods(db);
  const { merchantId, userId, amount, currency, paymentMethod, metadata } = req.body || {};
  
  if (!merchantId || !userId || !amount || !currency || !paymentMethod) {
    return res.status(400).json({ error: 'Укажите merchantId, userId, amount, currency, paymentMethod' });
  }
  
  const merchant = db.merchants.find(m => m.id === parseInt(merchantId, 10));
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  if (!merchant.enabled) return res.status(400).json({ error: 'Мерчант отключен' });
  
  const method = db.paymentMethods.find(m => m.id === paymentMethod);
  if (!method || !method.enabled) return res.status(400).json({ error: 'Метод оплаты недоступен' });
  
  const amountNum = Number(amount);
  if (amountNum < method.min || amountNum > method.max) {
    return res.status(400).json({ error: `Сумма должна быть от ${method.min} до ${method.max}` });
  }
  
  const transaction = {
    id: nextId(db.transactions || []),
    merchantId: String(merchantId),
    userId: String(userId),
    amount: amountNum,
    currency: String(currency),
    paymentMethod: String(paymentMethod),
    status: 'pending',
    type: 'deposit',
    direction: 'in', // входящий платеж к мерчанту
    createdAt: new Date().toISOString(),
    metadata: metadata || {},
  };
  
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(transaction);
  saveDb(db);
  
  res.status(201).json(transaction);
});

// Создать транзакцию вывода (пользователь выводит через мерчанта)
app.post('/api/transactions/withdraw', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  initPaymentMethods(db);
  const { merchantId, userId, amount, currency, paymentMethod, accountDetails, metadata } = req.body || {};
  
  if (!merchantId || !userId || !amount || !currency || !paymentMethod || !accountDetails) {
    return res.status(400).json({ error: 'Укажите merchantId, userId, amount, currency, paymentMethod, accountDetails' });
  }
  
  const merchant = db.merchants.find(m => m.id === parseInt(merchantId, 10));
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  if (!merchant.enabled) return res.status(400).json({ error: 'Мерчант отключен' });
  
  const method = db.paymentMethods.find(m => m.id === paymentMethod);
  if (!method || !method.enabled) return res.status(400).json({ error: 'Метод оплаты недоступен' });
  
  const amountNum = Number(amount);
  if (amountNum < method.min || amountNum > method.max) {
    return res.status(400).json({ error: `Сумма должна быть от ${method.min} до ${method.max}` });
  }
  
  // Проверка баланса мерчанта (для вывода нужен баланс)
  if ((merchant.balance || 0) < amountNum) {
    return res.status(400).json({ error: 'Недостаточно средств на счете мерчанта' });
  }
  
  const transaction = {
    id: nextId(db.transactions || []),
    merchantId: String(merchantId),
    userId: String(userId),
    amount: amountNum,
    currency: String(currency),
    paymentMethod: String(paymentMethod),
    status: 'pending',
    type: 'withdraw',
    direction: 'out', // исходящий платеж от мерчанта
    accountDetails: accountDetails,
    createdAt: new Date().toISOString(),
    metadata: metadata || {},
  };
  
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(transaction);
  saveDb(db);
  
  res.status(201).json(transaction);
});

// Получить транзакции
app.get('/api/transactions', requireAuth, (req, res) => {
  const db = getDb();
  const { merchantId, userId, status } = req.query;
  let transactions = getUserTransactions(db, req.user.id);
  
  if (merchantId) transactions = transactions.filter(t => String(t.merchantId) === String(merchantId));
  if (userId) transactions = transactions.filter(t => t.userId === userId);
  if (status) transactions = transactions.filter(t => t.status === status);
  
  res.json(transactions);
});

// Обновить статус транзакции
app.patch('/api/transactions/:id', requireAuth, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const { status, error } = req.body || {};
  
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
  
  const transaction = db.transactions.find(t => t.id === id);
  if (!transaction) return res.status(404).json({ error: 'Транзакция не найдена' });
  
  const oldStatus = transaction.status;
  
  if (status) {
    transaction.status = status;
    if (status === 'completed' || status === 'failed') {
      transaction.updatedAt = new Date().toISOString();
    }
    
    // Обновление баланса мерчанта при завершении транзакции
    if (status === 'completed' && oldStatus !== 'completed') {
      const merchant = db.merchants.find(m => m.id === parseInt(transaction.merchantId, 10));
      if (merchant) {
        if (transaction.type === 'deposit' && transaction.direction === 'in') {
          // Депозит пользователя: мерчант получает деньги (увеличивает баланс)
          merchant.balance = (merchant.balance || 0) + transaction.amount;
        } else if (transaction.type === 'withdraw' && transaction.direction === 'out') {
          // Вывод пользователя: мерчант отправляет деньги (уменьшает баланс)
          merchant.balance = (merchant.balance || 0) - transaction.amount;
        }
        saveDb(db);
      }
    }
    
    // Откат баланса при отмене завершенной транзакции
    if ((status === 'failed' || status === 'pending') && oldStatus === 'completed') {
      const merchant = db.merchants.find(m => m.id === parseInt(transaction.merchantId, 10));
      if (merchant) {
        if (transaction.type === 'deposit' && transaction.direction === 'in') {
          merchant.balance = (merchant.balance || 0) - transaction.amount;
        } else if (transaction.type === 'withdraw' && transaction.direction === 'out') {
          merchant.balance = (merchant.balance || 0) + transaction.amount;
        }
        saveDb(db);
      }
    }
  }
  if (error) transaction.error = String(error);

  saveDb(db);

  res.json(transaction);
});

// KYC верификация
app.post('/api/kyc/verify', requireAuth, (req, res) => {
  const db = getDb();
  const { userId, documents, personalInfo } = req.body || {};
  
  if (!userId) return res.status(400).json({ error: 'Укажите userId' });
  
  const verification = {
    id: nextId(db.kycVerifications || []),
    userId: String(userId),
    status: 'pending',
    documents: documents || [],
    personalInfo: personalInfo || {},
    createdAt: new Date().toISOString(),
  };
  
  if (!Array.isArray(db.kycVerifications)) db.kycVerifications = [];
  db.kycVerifications.push(verification);
  saveDb(db);
  
  res.status(201).json(verification);
});

// ========== ЗАЯВКИ НА ВЫПЛАТУ (P2P) ==========

const PAYOUT_TIME_LIMIT_MS = 20 * 60 * 1000; // 20 минут
const REFERRAL_PERCENT = 0.5;
const COMMISSION_TIERS = [
  { min: 100, max: 999, percent: 13.5, minDeposit: 5000 },
  { min: 1000, max: 4999, percent: 10.5, minDeposit: 10000 },
  { min: 5000, max: 19999, percent: 10, minDeposit: 30000 },
  { min: 20000, max: 300000, percent: 8, minDeposit: 50000 },
];
function getCommissionRate(amount, insuranceDeposit) {
  const tier = COMMISSION_TIERS.find(t => amount >= t.min && amount <= t.max && insuranceDeposit >= t.minDeposit);
  return tier ? tier.percent : COMMISSION_TIERS[0]?.percent ?? 13.5;
}

function initPayoutRequests(db) {
  if (!Array.isArray(db.payoutRequests)) db.payoutRequests = [];
  if (db.payoutRequests.length === 0) {
    db.payoutRequests = [
      { id: 1, amount: 5000, currency: '₽', paymentMethod: 'sbp', bank: 'Сбербанк', requisites: '+7 900 123 45 67', status: 'pending', createdAt: new Date().toISOString() },
      { id: 2, amount: 15000, currency: '₽', paymentMethod: 'card_ru', bank: 'Тинькофф', requisites: '1234 5678 9012 3456', status: 'pending', createdAt: new Date().toISOString() },
      { id: 3, amount: 3000, currency: '₽', paymentMethod: 'sbp', bank: 'ВТБ', requisites: '+7 900 987 65 43', status: 'pending', createdAt: new Date().toISOString() },
      { id: 4, amount: 25000, currency: '₽', paymentMethod: 'card_ru', bank: 'Сбербанк', requisites: '5536 9138 1234 5678', status: 'pending', createdAt: new Date().toISOString() },
      { id: 5, amount: 8000, currency: '₽', paymentMethod: 'sbp', bank: 'Райффайзен', requisites: '+7 916 555 12 34', status: 'pending', createdAt: new Date().toISOString() },
    ];
    saveDb(db);
  }
  // Миграция: добавляем банк к старым записям без банка
  const bankById = { 1: 'Сбербанк', 2: 'Тинькофф', 3: 'ВТБ', 4: 'Сбербанк', 5: 'Райффайзен' };
  let needsSave = false;
  db.payoutRequests.forEach((r) => {
    if (!r.bank) {
      r.bank = bankById[r.id] || (r.paymentMethod === 'sbp' ? 'СБП' : r.paymentMethod === 'card_ru' ? 'Карта' : '');
      needsSave = true;
    }
  });
  if (needsSave) saveDb(db);
}

function ensureShopMerchant(db, user) {
  if (!user || user.role !== 'shop') return;
  initMerchants(db);
  const existing = db.merchants.find((m) => String(m.userId) === String(user.id));
  if (!existing) {
    db.merchants.push({
      id: nextId(db.merchants),
      name: `${user.name || 'Казино'} (казино)`,
      apiKey: 'merchant_' + crypto.randomBytes(16).toString('hex'),
      balance: 0,
      enabled: true,
      userId: user.id,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
  }
}

function scopePayoutRequestsForUser(requests, user) {
  if (user.role === 'shop') {
    return requests.filter((r) => String(r.shopUserId) === String(user.id));
  }
  const uid = String(user.id);
  return requests.filter(
    (r) =>
      r.status === 'pending' ||
      String(r.traderId) === uid ||
      String(r.cancelledBy) === uid
  );
}

// Список заявок на выплату (по умолчанию pending, можно status=all для истории)
app.get('/api/payout-requests', requireAuth, (req, res) => {
  const db = getDb();
  initPayoutRequests(db);
  initPaymentMethods(db);
  const { amountFrom, amountTo, status, paymentMethod } = req.query;
  let requests = db.payoutRequests || [];

  if (amountFrom) requests = requests.filter(r => r.amount >= Number(amountFrom));
  if (amountTo) requests = requests.filter(r => r.amount <= Number(amountTo));
  if (status && status !== 'all') requests = requests.filter(r => r.status === status);
  if (paymentMethod) requests = requests.filter(r => r.paymentMethod === paymentMethod);

  requests = scopePayoutRequestsForUser(requests, req.user);
  requests = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(requests);
});

// Новая заявка на выплату (казино / API)
app.post('/api/payout-requests', requireAuth, (req, res) => {
  const db = getDb();
  initPayoutRequests(db);
  if (req.user.role === 'shop') {
    const u = ensureShopVerificationFields(db, findDbUser(db, req.user.id) || req.user);
    if (!isShopVerified(u)) {
      return res.status(403).json({ error: 'Аккаунт не подтверждён. Напишите в Telegram @d33dd33d' });
    }
  }
  if (req.user.role === 'merchant') {
    return res.status(403).json({ error: 'Трейдеры создают выплаты через принятие заявок, а не через API казино' });
  }
  const { amount, paymentMethod, bank, requisites, currency, externalId } = req.body || {};
  const amountNum = Number(amount);
  if (!amountNum || amountNum < 100) {
    return res.status(400).json({ error: 'Укажите сумму от 100 ₽' });
  }
  if (!paymentMethod || !['sbp', 'card_ru'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'paymentMethod: sbp или card_ru' });
  }
  if (!requisites) return res.status(400).json({ error: 'Укажите requisites' });

  if (req.user.role === 'shop') {
    ensureShopMerchant(db, req.user);
  }

  const request = {
    id: nextId(db.payoutRequests),
    amount: amountNum,
    currency: currency || '₽',
    paymentMethod,
    bank: bank ? String(bank) : '',
    requisites: String(requisites),
    externalId: externalId ? String(externalId).slice(0, 64) : null,
    shopUserId: req.user.role === 'shop' ? req.user.id : req.body.shopUserId || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.payoutRequests.push(request);
  saveDb(db);
  res.status(201).json(request);
});

// Трейдер принимает заявку
app.post('/api/payout-requests/:id/accept', requireAuth, (req, res) => {
  if (req.user.role === 'shop') {
    return res.status(403).json({ error: 'Казино не может принимать заявки на выплату' });
  }
  const db = getDb();
  initPayoutRequests(db);
  const id = parseInt(req.params.id, 10);
  const request = db.payoutRequests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Заявка уже занята' });

  request.status = 'in_progress';
  request.traderId = req.user.id;
  request.acceptedAt = new Date().toISOString();
  request.expiresAt = new Date(Date.now() + PAYOUT_TIME_LIMIT_MS).toISOString();
  saveDb(db);
  res.json(request);
});

// Трейдер завершает выплату (загружает чек)
app.patch('/api/payout-requests/:id/complete', requireAuth, (req, res) => {
  if (req.user.role === 'shop') {
    return res.status(403).json({ error: 'Казино не может завершать заявки трейдеров' });
  }
  const db = getDb();
  initPayoutRequests(db);
  initMerchants(db);
  const id = parseInt(req.params.id, 10);
  const { receiptBase64 } = req.body || {};
  const request = db.payoutRequests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (request.status !== 'in_progress') return res.status(400).json({ error: 'Заявка не в обработке' });
  if (request.traderId !== req.user.id) return res.status(403).json({ error: 'Не ваша заявка' });
  if (!receiptBase64) return res.status(400).json({ error: 'Загрузите чек (PDF, JPG или JPEG)' });

  const now = new Date();
  if (new Date(request.expiresAt) < now) return res.status(400).json({ error: 'Время на оплату истекло' });

  const traderMerchant = getUserMerchant(db, req.user.id);
  if (!traderMerchant) return res.status(400).json({ error: 'Мерчант не найден' });
  const merchant = traderMerchant;
  const trader = req.user;
  const hasReferrer = !!trader.referrerId;
  const traderInsuranceDeposit = (db.transactions || [])
    .filter(t => t.type === 'merchant_deposit' && t.status === 'completed' && String(t.merchantId) === String(merchant?.id))
    .reduce((sum, t) => sum + t.amount, 0);
  const baseRate = getCommissionRate(request.amount, traderInsuranceDeposit);
  const traderRate = hasReferrer ? baseRate - REFERRAL_PERCENT : baseRate;
  const referralCut = hasReferrer ? Math.round(request.amount * (REFERRAL_PERCENT / 100)) : 0;
  const merchantCommission = Math.round(request.amount * (traderRate / 100));
  const rewardAmount = request.amount + Math.max(0, merchantCommission);

  request.status = 'completed';
  request.completedAt = now.toISOString();
  request.receiptBase64 = receiptBase64;

  if (merchant) {
    merchant.balance = (merchant.balance || 0) + rewardAmount;
  }
  const tx = {
    id: nextId(db.transactions || []),
    type: 'payout_reward',
    merchantId: String(merchant?.id || 1),
    amount: rewardAmount,
    baseAmount: request.amount,
    commission: Math.max(0, merchantCommission),
    currency: '₽',
    status: 'completed',
    payoutRequestId: request.id,
    createdAt: now.toISOString(),
  };
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(tx);

  if (hasReferrer && referralCut > 0) {
    const referrer = db.users.find(u => u.id === trader.referrerId);
    const referrerMerchant = referrer ? db.merchants.find(m => String(m.userId) === String(referrer.id)) : null;
    if (referrerMerchant) {
      referrerMerchant.balance = (referrerMerchant.balance || 0) + referralCut;
    }
    db.transactions.push({
      id: nextId(db.transactions),
      type: 'referral_reward',
      userId: String(referrer.id),
      referrerId: String(referrer.id),
      referredUserId: String(trader.id),
      amount: referralCut,
      baseAmount: request.amount,
      sourceType: 'payout_reward',
      sourceTransactionId: tx.id,
      currency: '₽',
      status: 'completed',
      createdAt: now.toISOString(),
    });
  }

  saveDb(db);
  res.json({ ...request, rewardAmount });
});

// Трейдер отменяет принятую заявку
app.post('/api/payout-requests/:id/cancel', requireAuth, (req, res) => {
  if (req.user.role === 'shop') {
    return res.status(403).json({ error: 'Казино не может отменять заявки трейдеров' });
  }
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const request = db.payoutRequests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (request.status !== 'in_progress' || request.traderId !== req.user.id) {
    return res.status(400).json({ error: 'Невозможно отменить' });
  }
  request.status = 'cancelled';
  request.cancelledAt = new Date().toISOString();
  request.cancelledBy = req.user.id;
  request.traderId = null;
  request.acceptedAt = null;
  request.expiresAt = null;
  saveDb(db);
  res.json(request);
});

// ========== АПЕЛЛЯЦИИ КАЗИНО (магазин создаёт спор по выводу/депозиту) ==========

const SHOP_APPEAL_TYPES = ['withdrawal', 'deposit', 'other'];
const SHOP_APPEAL_STATUSES = ['pending', 'in_review', 'resolved', 'rejected', 'cancelled'];

function initShopAppeals(db) {
  if (!Array.isArray(db.shopAppeals)) db.shopAppeals = [];
}

app.get('/api/shop-appeals', requireAuth, (req, res) => {
  const db = getDb();
  initShopAppeals(db);
  const { status } = req.query;
  let appeals = db.shopAppeals || [];

  if (req.user.role === 'shop') {
    appeals = appeals.filter((a) => String(a.shopUserId) === String(req.user.id));
  } else if (req.user.role !== 'merchant') {
    return res.status(403).json({ error: 'Нет доступа к апелляциям' });
  }

  if (status && status !== 'all') {
    appeals = appeals.filter((a) => a.status === status);
  }
  appeals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(appeals);
});

app.post('/api/shop-appeals', requireAuth, (req, res) => {
  if (req.user.role !== 'shop') {
    return res.status(403).json({ error: 'Только казино может создавать апелляции' });
  }
  const db = getDb();
  initShopAppeals(db);
  initPayoutRequests(db);
  const u = ensureShopVerificationFields(db, findDbUser(db, req.user.id) || req.user);
  if (!isShopVerified(u)) {
    return res.status(403).json({ error: 'Аккаунт не подтверждён. Напишите в Telegram @d33dd33d' });
  }

  const { type, payoutRequestId, externalId, amount, description, id: playerIdField } = req.body || {};
  if (!type || !SHOP_APPEAL_TYPES.includes(type)) {
    return res.status(400).json({ error: 'type: withdrawal, deposit или other' });
  }
  const desc = String(description || '').trim();
  if (!desc) {
    return res.status(400).json({ error: 'Укажите описание проблемы' });
  }

  let payoutId = null;
  if (payoutRequestId != null && payoutRequestId !== '') {
    payoutId = parseInt(payoutRequestId, 10);
    const payout = db.payoutRequests.find((r) => r.id === payoutId);
    if (!payout || String(payout.shopUserId) !== String(req.user.id)) {
      return res.status(400).json({ error: 'Заявка на вывод не найдена' });
    }
  }

  const amountNum = amount != null && amount !== '' ? Number(amount) : null;
  if (amountNum != null && (Number.isNaN(amountNum) || amountNum < 0)) {
    return res.status(400).json({ error: 'Некорректная сумма' });
  }

  const playerId = playerIdField ?? externalId;

  const appeal = {
    id: nextId(db.shopAppeals),
    shopUserId: req.user.id,
    shopName: u.name || '',
    type,
    payoutRequestId: payoutId,
    externalId: playerId != null && playerId !== '' ? String(playerId).slice(0, 64) : null,
    amount: amountNum,
    description: desc.slice(0, 2000),
    status: 'pending',
    resolution: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.shopAppeals.push(appeal);
  saveDb(db);
  res.status(201).json(appeal);
});

app.patch('/api/shop-appeals/:id', requireAuth, (req, res) => {
  const db = getDb();
  initShopAppeals(db);
  const id = parseInt(req.params.id, 10);
  const appeal = db.shopAppeals.find((a) => a.id === id);
  if (!appeal) return res.status(404).json({ error: 'Апелляция не найдена' });

  const { status, resolution } = req.body || {};

  if (req.user.role === 'shop') {
    if (String(appeal.shopUserId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    if (status === 'cancelled' && appeal.status === 'pending') {
      appeal.status = 'cancelled';
      appeal.updatedAt = new Date().toISOString();
      saveDb(db);
      return res.json(appeal);
    }
    return res.status(403).json({ error: 'Казино может только отменить апелляцию в статусе «ожидает»' });
  }

  if (req.user.role === 'merchant') {
    if (status && SHOP_APPEAL_STATUSES.includes(status) && status !== 'cancelled') {
      appeal.status = status;
    }
    if (resolution != null) {
      appeal.resolution = String(resolution).trim().slice(0, 2000);
    }
    appeal.updatedAt = new Date().toISOString();
    saveDb(db);
    return res.json(appeal);
  }

  return res.status(403).json({ error: 'Нет доступа' });
});

// ========== УСТРОЙСТВА (РЕКВИЗИТЫ МЕРЧАНТА) ==========

function initMerchantDevices(db) {
  if (!Array.isArray(db.merchantDevices)) db.merchantDevices = [];
}

// Получить устройства мерчанта
app.get('/api/merchant-devices', requireAuth, (req, res) => {
  const db = getDb();
  initMerchantDevices(db);
  const devices = (db.merchantDevices || []).filter(d => String(d.userId) === String(req.user.id));
  res.json(devices);
});

// Добавить устройство
app.post('/api/merchant-devices', requireAuth, (req, res) => {
  const db = getDb();
  initMerchantDevices(db);
  const { type, requisites, bank, limitRange, maxTurnoverPerDay, maxTurnoverTotal } = req.body || {};
  if (!type || !requisites || !limitRange) {
    return res.status(400).json({ error: 'Укажите type, requisites и limitRange' });
  }
  if (!['card_ru', 'sbp'].includes(type)) {
    return res.status(400).json({ error: 'type должен быть card_ru или sbp' });
  }
  const validRanges = ['100-999', '1000-4999', '5000-19999', '20000-300000'];
  if (!validRanges.includes(limitRange)) {
    return res.status(400).json({ error: 'Недопустимый лимит' });
  }
  const transactions = db.transactions || [];
  const insuranceDeposit = transactions
    .filter(t => t.type === 'merchant_deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const rangeMinDeposit = { '100-999': 5000, '1000-4999': 10000, '5000-19999': 30000, '20000-300000': 50000 };
  if (insuranceDeposit < rangeMinDeposit[limitRange]) {
    return res.status(400).json({ error: 'Недостаточный страховой депозит для выбранного лимита' });
  }
  if (insuranceDeposit < 5000) {
    return res.status(400).json({ error: 'Страховой депозит должен быть от 5 000 ₽' });
  }
  const device = {
    id: nextId(db.merchantDevices),
    userId: req.user.id,
    type: String(type),
    requisites: String(requisites).trim(),
    bank: String(bank || '').trim(),
    limitRange: String(limitRange),
    maxTurnoverPerDay: Math.max(0, Number(maxTurnoverPerDay) || 0),
    maxTurnoverTotal: Math.max(0, Number(maxTurnoverTotal) || 0),
    online: true,
    createdAt: new Date().toISOString(),
  };
  db.merchantDevices.push(device);
  saveDb(db);
  res.status(201).json(device);
});

// Редактировать устройство
app.patch('/api/merchant-devices/:id', requireAuth, (req, res) => {
  const db = getDb();
  initMerchantDevices(db);
  const id = parseInt(req.params.id, 10);
  const device = db.merchantDevices?.find(d => d.id === id);
  if (!device) return res.status(404).json({ error: 'Устройство не найдено' });
  if (String(device.userId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Не ваше устройство' });
  }
  const { type, requisites, bank, limitRange, maxTurnoverPerDay, maxTurnoverTotal, online } = req.body || {};
  if (online !== undefined) device.online = Boolean(online);
  if (type !== undefined) {
    if (!['card_ru', 'sbp'].includes(type)) {
      return res.status(400).json({ error: 'type должен быть card_ru или sbp' });
    }
    device.type = String(type);
  }
  if (requisites !== undefined) {
    if (!String(requisites).trim()) return res.status(400).json({ error: 'Укажите реквизиты' });
    device.requisites = String(requisites).trim();
  }
  if (bank !== undefined) device.bank = String(bank || '').trim();
  if (limitRange !== undefined) {
    const validRanges = ['100-999', '1000-4999', '5000-19999', '20000-300000'];
    if (!validRanges.includes(limitRange)) {
      return res.status(400).json({ error: 'Недопустимый лимит' });
    }
    const transactions = db.transactions || [];
    const insuranceDeposit = transactions
      .filter(t => t.type === 'merchant_deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    const rangeMinDeposit = { '100-999': 5000, '1000-4999': 10000, '5000-19999': 30000, '20000-300000': 50000 };
    if (insuranceDeposit < rangeMinDeposit[limitRange]) {
      return res.status(400).json({ error: 'Недостаточный страховой депозит для выбранного лимита' });
    }
    device.limitRange = String(limitRange);
  }
  if (maxTurnoverPerDay !== undefined) device.maxTurnoverPerDay = Math.max(0, Number(maxTurnoverPerDay) || 0);
  if (maxTurnoverTotal !== undefined) device.maxTurnoverTotal = Math.max(0, Number(maxTurnoverTotal) || 0);
  saveDb(db);
  res.json(device);
});

// Удалить устройство
app.delete('/api/merchant-devices/:id', requireAuth, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const device = db.merchantDevices?.find(d => d.id === id);
  if (!device) return res.status(404).json({ error: 'Устройство не найдено' });
  if (String(device.userId) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Не ваше устройство' });
  }
  db.merchantDevices = db.merchantDevices.filter(d => d.id !== id);
  saveDb(db);
  res.json({ ok: true });
});

// Получить статистику
app.get('/api/stats', requireAuth, (req, res) => {
  const db = getDb();
  initPayoutRequests(db);
  const merchant = getUserMerchant(db, req.user.id);
  const balance = merchant?.balance ?? 0;

  if (req.user.role === 'shop') {
    ensureShopMerchant(db, req.user);
    const shopPayouts = (db.payoutRequests || []).filter(
      (r) => String(r.shopUserId) === String(req.user.id)
    );
    const transactions = getUserTransactions(db, req.user.id);
    const deposits = transactions.filter(
      (t) => t.type === 'deposit' || t.type === 'merchant_deposit' || t.direction === 'in'
    );
    const completedWithdrawals = shopPayouts.filter((r) => r.status === 'completed');
    initShopAppeals(db);
    const dbUser = findDbUser(db, req.user.id);
    const shopAppeals = (db.shopAppeals || []).filter(
      (a) => String(a.shopUserId) === String(req.user.id)
    );
    const stats = {
      role: 'shop',
      balance,
      merchantId: merchant?.id ?? null,
      withdrawalsTotal: shopPayouts.length,
      withdrawalsPending: shopPayouts.filter((r) => r.status === 'pending').length,
      withdrawalsInProgress: shopPayouts.filter((r) => r.status === 'in_progress').length,
      withdrawalsCompleted: completedWithdrawals.length,
      withdrawalsVolume: completedWithdrawals.reduce((s, r) => s + (r.amount || 0), 0),
      depositsCount: deposits.filter((t) => t.status === 'completed').length,
      depositsVolume: deposits
        .filter((t) => t.status === 'completed')
        .reduce((s, t) => s + (t.amount || 0), 0),
      depositsPending: deposits.filter((t) => t.status === 'pending').length,
      appealsTotal: shopAppeals.length,
      appealsPending: shopAppeals.filter((a) => a.status === 'pending' || a.status === 'in_review').length,
      siteUrl: merchant?.siteUrl || normalizeShopSettings(dbUser?.settings).casinoSiteUrl || '',
    };
    return res.json(stats);
  }

  const transactions = getUserTransactions(db, req.user.id);
  const payoutRequests = db.payoutRequests || [];
  const userPayouts = payoutRequests.filter((r) => String(r.traderId) === String(req.user.id));

  const insuranceDeposit = transactions
    .filter(t => t.type === 'merchant_deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const workingDeposit = transactions
    .filter(t => t.type === 'payout_reward' && t.status === 'completed')
    .reduce((sum, t) => sum + (t.commission ?? Math.round((t.baseAmount ?? t.amount) * 0.01)), 0);
  const pendingPayouts = payoutRequests.filter(r => r.status === 'pending').length;
  const pendingDeals = transactions.filter(t => t.status === 'pending' && t.type === 'deposit' && t.direction === 'in').length;
  const appealsCount = transactions.filter(t => t.status === 'failed').length;

  const stats = {
    totalTransactions: transactions.length,
    totalAmount: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0),
    pending: transactions.filter(t => t.status === 'pending').length,
    completed: transactions.filter(t => t.status === 'completed').length,
    failed: transactions.filter(t => t.status === 'failed').length,
    balance,
    insuranceDeposit,
    workingDeposit,
    payoutCompleted: userPayouts.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.amount || 0), 0),
    payoutCompletedCount: userPayouts.filter(r => r.status === 'completed').length,
    pendingPayouts,
    pendingDeals,
    appealsCount,
    byMethod: {},
  };

  transactions.forEach(t => {
    if (!stats.byMethod[t.paymentMethod]) {
      stats.byMethod[t.paymentMethod] = { count: 0, amount: 0 };
    }
    stats.byMethod[t.paymentMethod].count++;
    if (t.status === 'completed') {
      stats.byMethod[t.paymentMethod].amount += t.amount;
    }
  });

  res.json(stats);
});

// ========== МАГАЗИН (P2P для питупишеров) ==========

const SHOP_CATALOG_VERSION = 9;

function getShopCatalog() {
  return [
    {
      id: 13,
      title: 'ЛК Ozon Банк',
      description: '',
      category: 'bank_lk',
      price: 2000,
      currency: '₽',
      image: '/shop/ozon.webp',
      bankName: 'Ozon Банк',
      deliveryType: 'bank_lk',
      enabled: true,
    },
    {
      id: 6,
      title: 'ЛК ВТБ',
      description: '',
      category: 'bank_lk',
      price: 3000,
      currency: '₽',
      image: '/shop/vtb.webp',
      bankName: 'ВТБ',
      deliveryType: 'bank_lk',
      enabled: true,
    },
    {
      id: 5,
      title: 'ЛК Т-Банк',
      description: '',
      category: 'bank_lk',
      price: 3800,
      currency: '₽',
      image: '/shop/tbank.png',
      bankName: 'Т-Банк',
      deliveryType: 'bank_lk',
      enabled: true,
    },
    {
      id: 4,
      title: 'ЛК Сбербанк',
      description: '',
      category: 'bank_lk',
      price: 5000,
      currency: '₽',
      image: '/shop/sber.png',
      bankName: 'Сбербанк',
      deliveryType: 'bank_lk',
      enabled: true,
    },
    {
      id: 10,
      title: 'ЛК Альфа-Банк',
      description: '',
      category: 'bank_lk',
      price: 7500,
      currency: '₽',
      image: '/shop/alfa.webp',
      bankName: 'Альфа-Банк',
      deliveryType: 'bank_lk',
      enabled: true,
    },
    {
      id: 12,
      title: 'Аккаунт Госуслуги',
      description: '',
      category: 'services',
      price: 4500,
      currency: '₽',
      image: '/shop/gosuslugi.png',
      serviceName: 'Госуслуги',
      deliveryType: 'account',
      enabled: true,
    },
  ];
}

function buildOrderDelivery(product, orderId) {
  if (product.deliveryType === 'download' && product.fileUrl) {
    return {
      type: 'download',
      fileUrl: product.fileUrl,
      fileLabel: 'Скачать материал',
    };
  }
  if (product.deliveryType === 'sim') {
    const suffix = crypto.randomBytes(3).toString('hex');
    const phone = `+7${900 + Math.floor(Math.random() * 100)}${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
    return {
      type: 'sim',
      operator: product.operatorName || 'Билайн',
      phone,
      iccid: `89${String(Math.floor(Math.random() * 1e18)).padStart(18, '0')}`,
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      note: 'SIM активирована. Не передавайте данные третьим лицам.',
    };
  }
  if (product.deliveryType === 'account') {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const snils = `${String(Math.floor(Math.random() * 999)).padStart(3, '0')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')} ${Math.floor(Math.random() * 99)}`;
    return {
      type: 'account',
      service: product.serviceName || 'Госуслуги',
      login: `gu_${orderId}_${suffix.toLowerCase()}`,
      password: crypto.randomBytes(9).toString('base64url'),
      snils,
      note: 'Аккаунт подтверждён. Смените пароль при первом входе.',
    };
  }
  if (product.deliveryType === 'bank_lk') {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    return {
      type: 'bank_lk',
      bank: product.bankName || product.title,
      accessId: `EP-${orderId}-${suffix}`,
      login: `lk_${orderId}_${suffix.toLowerCase()}`,
      password: crypto.randomBytes(9).toString('base64url'),
      note: 'Доступ выдан на сайте. Смените пароль при первом входе. Срок: 30 дней.',
    };
  }
  if (product.deliveryType === 'pack') {
    const banks = product.packBanks || [];
    return {
      type: 'pack',
      accessCode: `PACK-${orderId}`,
      items: banks.map((bank, i) => ({
        bank,
        login: `pack_${orderId}_${i + 1}`,
        password: crypto.randomBytes(8).toString('base64url'),
      })),
      note: 'Все доступы выданы автоматически. Храните данные в безопасном месте.',
    };
  }
  return { type: 'info', message: 'Товар выдан. Подробности в заказе.' };
}

function initShopProducts(db) {
  if (!Array.isArray(db.shopProducts)) db.shopProducts = [];
  if (!Array.isArray(db.shopOrders)) db.shopOrders = [];
  if (!db.config) db.config = { name: 'Enter Pay', currency: '₽' };
  if (db.config.shopCatalogVersion === SHOP_CATALOG_VERSION) return;

  db.shopProducts = getShopCatalog();
  db.config.shopCatalogVersion = SHOP_CATALOG_VERSION;
  saveDb(db);
}

app.get('/api/shop/info', requireAuth, (req, res) => {
  res.json({});
});

app.get('/api/shop/products', requireAuth, (req, res) => {
  const db = getDb();
  initShopProducts(db);
  const { category } = req.query;
  let products = (db.shopProducts || []).filter((p) => p.enabled !== false);
  if (category && category !== 'all') {
    products = products.filter((p) => p.category === category);
  }
  res.json(products);
});

app.get('/api/shop/orders', requireAuth, (req, res) => {
  const db = getDb();
  initShopProducts(db);
  const orders = (db.shopOrders || [])
    .filter((o) => String(o.userId) === String(req.user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});

app.post('/api/shop/orders', requireAuth, (req, res) => {
  const db = getDb();
  initShopProducts(db);
  initMerchants(db);
  const productId = parseInt(req.body?.productId, 10);
  if (!productId) return res.status(400).json({ error: 'Укажите productId' });

  const product = (db.shopProducts || []).find((p) => p.id === productId && p.enabled !== false);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const merchant = getUserMerchant(db, req.user.id);
  if (!merchant) return res.status(400).json({ error: 'Сначала завершите регистрацию мерчанта' });

  const price = Number(product.price) || 0;
  if ((merchant.balance || 0) < price) {
    return res.status(400).json({ error: 'Недостаточно средств на балансе. Пополните кошелёк.' });
  }

  merchant.balance = (merchant.balance || 0) - price;

  const orderId = nextId(db.shopOrders || []);
  const now = new Date().toISOString();
  const delivery = buildOrderDelivery(product, orderId);

  const order = {
    id: orderId,
    userId: req.user.id,
    productId: product.id,
    productTitle: product.title,
    category: product.category,
    amount: price,
    currency: product.currency || '₽',
    status: 'completed',
    delivery,
    createdAt: now,
    completedAt: now,
  };

  if (!Array.isArray(db.shopOrders)) db.shopOrders = [];
  db.shopOrders.push(order);

  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push({
    id: nextId(db.transactions),
    type: 'shop_purchase',
    merchantId: String(merchant.id),
    amount: price,
    currency: product.currency || '₽',
    status: 'completed',
    productId: product.id,
    shopOrderId: order.id,
    description: product.title,
    createdAt: order.createdAt,
  });

  saveDb(db);
  res.json({ order, balance: merchant.balance });
});

module.exports = app;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Enter Pay Backend: http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${PORT} is already in use.`);
      console.error('Run stop-dev.bat in the project folder, then start again.\n');
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}
