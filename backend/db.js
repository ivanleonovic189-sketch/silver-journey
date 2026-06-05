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
  config: { name: 'Enter Pay', currency: '₽' },
};

function readSeedDb() {
  const seedPath = getSeedPath();
  if (!seedPath) return { ...defaultData };
  try {
    return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  } catch {
    return { ...defaultData };
  }
}

function nextId(arr) {
  const max = arr.length ? Math.max(...arr.map((x) => x.id)) : 0;
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

async function initDbAsync() {
  if (!isServerless) return initDb();
  if (memoryCache) return memoryCache;

  const seed = readSeedDb();

  try {
    const blob = await loadFromBlob();
    if (blob && Array.isArray(blob.users) && blob.users.length > 0) {
      memoryCache = blob;
      return memoryCache;
    }
    if (blob) {
      memoryCache = {
        ...seed,
        ...blob,
        users: [...(seed.users || []), ...(blob.users || [])].filter(
          (u, i, arr) => arr.findIndex((x) => x.email === u.email) === i
        ),
      };
      return memoryCache;
    }
  } catch (err) {
    console.error('Blob load failed:', err);
  }

  memoryCache = seed;
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

function saveDb(data) {
  memoryCache = data;
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');

  if (isServerless) {
    saveToBlob(data).catch((err) => console.error('Blob save failed:', err));
  }
}

async function saveDbAsync(data) {
  memoryCache = data;
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');

  if (isServerless) {
    try {
      await saveToBlob(data);
    } catch (err) {
      console.error('Blob save failed (non-fatal):', err);
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

module.exports = { initDb, initDbAsync, ensureDbReady, getDb, loadDb, saveDb, saveDbAsync, nextId };
