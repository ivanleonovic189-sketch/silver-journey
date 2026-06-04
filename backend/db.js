const fs = require('fs');
const path = require('path');
const os = require('os');

const isServerless = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

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
  config: { name: 'Enter Pay', currency: '₽' },
};

function nextId(arr) {
  const max = arr.length ? Math.max(...arr.map((x) => x.id)) : 0;
  return max + 1;
}

function loadDb() {
  try {
    const raw = fs.readFileSync(getDbPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { ...defaultData };
  }
}

function saveDb(data) {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function initDb() {
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

module.exports = { initDb, getDb, loadDb, saveDb, nextId };
