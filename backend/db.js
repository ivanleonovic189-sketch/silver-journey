const fs = require('fs');
const path = require('path');
const os = require('os');

const isServerless = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const BLOB_KEY = 'payments';

let memoryCache = null;
let initPromise = null;

function getDbPath() {
  return isServerless
    ? path.join(os.tmpdir(), 'enter-pay-payments.json')
    : path.join(__dirname, 'payments.json');
}

function getSeedPath() {
  const candidates = [
    path.join(__dirname, 'payments.json'),
    path.join(process.cwd(), 'backend', 'payments.json'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const defaultData = {
  transactions: [],
  paymentMethods: [],
  merchants: [],
  merchantDevices: [],
  kycVerifications: [],
  users: [],
  sessions: [],
  payoutRequests: [],
  shopProducts: [],
  shopOrders: [],
  shopAppeals: [],
  config: { name: 'Enter Pay', currency: '₽' },
};

function sanitizeSeedForServerless(data) {
  if (!data || typeof data !== 'object') return { ...defaultData };
  return {
    ...defaultData,
    config: data.config || defaultData.config,
    shopProducts: Array.isArray(data.shopProducts) ? data.shopProducts : [],
    paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
  };
}

function readSeedDb() {
  const seedPath = getSeedPath();
  if (!seedPath) return { ...defaultData };
  try {
    const parsed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    return isServerless ? sanitizeSeedForServerless(parsed) : parsed;
  } catch {
    return { ...defaultData };
  }
}

function nextId(arr) {
  const max = arr.length ? Math.max(...arr.map((x) => Number(x.id) || 0)) : 0;
  return max + 1;
}

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore('enter-pay-db');
}

async function loadFromBlob() {
  const store = await getBlobStore();
  return store.get(BLOB_KEY, { type: 'json' });
}

async function saveToBlob(data) {
  const store = await getBlobStore();
  await store.setJSON(BLOB_KEY, data);
}

function writeLocalCopy(data) {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

async function initDbAsync() {
  if (!isServerless) return initDb();
  if (memoryCache) return memoryCache;

  const seed = readSeedDb();

  try {
    const blob = await loadFromBlob();
    if (blob && typeof blob === 'object') {
      memoryCache = {
        ...defaultData,
        ...seed,
        ...blob,
        config: { ...defaultData.config, ...seed.config, ...(blob.config || {}) },
        shopProducts: Array.isArray(blob.shopProducts) && blob.shopProducts.length
          ? blob.shopProducts
          : seed.shopProducts,
        paymentMethods: Array.isArray(blob.paymentMethods) && blob.paymentMethods.length
          ? blob.paymentMethods
          : seed.paymentMethods,
        users: Array.isArray(blob.users) ? blob.users : [],
        sessions: Array.isArray(blob.sessions) ? blob.sessions : [],
        transactions: Array.isArray(blob.transactions) ? blob.transactions : [],
        merchants: Array.isArray(blob.merchants) ? blob.merchants : [],
        merchantDevices: Array.isArray(blob.merchantDevices) ? blob.merchantDevices : [],
        kycVerifications: Array.isArray(blob.kycVerifications) ? blob.kycVerifications : [],
        payoutRequests: Array.isArray(blob.payoutRequests) ? blob.payoutRequests : [],
        shopOrders: Array.isArray(blob.shopOrders) ? blob.shopOrders : [],
        shopAppeals: Array.isArray(blob.shopAppeals) ? blob.shopAppeals : [],
      };
      writeLocalCopy(memoryCache);
      return memoryCache;
    }
  } catch (err) {
    console.error('Blob load failed:', err);
  }

  memoryCache = { ...defaultData, ...seed };
  writeLocalCopy(memoryCache);
  try {
    await saveToBlob(memoryCache);
  } catch (err) {
    console.error('Blob seed save failed:', err);
  }
  return memoryCache;
}

function loadDb() {
  if (isServerless && memoryCache) return memoryCache;
  if (isServerless) return readSeedDb();
  try {
    const raw = fs.readFileSync(getDbPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { ...defaultData };
  }
}

async function reloadDbFromBlob() {
  if (!isServerless) return loadDb();
  try {
    const blob = await loadFromBlob();
    if (blob && typeof blob === 'object') {
      memoryCache = blob;
      writeLocalCopy(blob);
      return memoryCache;
    }
  } catch (err) {
    console.error('Blob reload failed:', err);
  }
  return memoryCache || loadDb();
}

function saveDb(data) {
  memoryCache = data;
  writeLocalCopy(data);

  if (isServerless) {
    saveToBlob(data).catch((err) => console.error('Blob save failed:', err));
  }
}

async function saveDbAsync(data) {
  memoryCache = data;
  writeLocalCopy(data);

  if (isServerless) {
    try {
      await saveToBlob(data);
    } catch (err) {
      console.error('Blob save failed (non-fatal):', err);
      throw err;
    }
  }
}

function initDb() {
  if (isServerless) {
    if (!initPromise) initPromise = initDbAsync();
    return memoryCache || readSeedDb();
  }

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    const seedPath = getSeedPath();
    if (seedPath) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.copyFileSync(seedPath, dbPath);
    } else {
      saveDb(defaultData);
    }
  }
  return loadDb();
}

function getDb() {
  return loadDb();
}

function ensureDbReady() {
  if (!isServerless) return Promise.resolve();
  if (!initPromise) initPromise = initDbAsync();
  return initPromise;
}

module.exports = {
  initDb,
  initDbAsync,
  ensureDbReady,
  reloadDbFromBlob,
  getDb,
  loadDb,
  saveDb,
  saveDbAsync,
  nextId,
  isServerless,
};
