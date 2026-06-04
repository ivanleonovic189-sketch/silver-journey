const fs = require('fs');
const path = require('path');

const isServerless = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

function getDbPath() {
  return isServerless
    ? path.join('/tmp', 'payments.json')
    : path.join(__dirname, 'payments.json');
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
  fs.writeFileSync(getDbPath(), JSON.stringify(data, null, 2), 'utf8');
}

function initDb() {
  const dbPath = getDbPath();
  if (isServerless && !fs.existsSync(dbPath)) {
    const seedPath = path.join(__dirname, 'payments.json');
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, dbPath);
    } else {
      saveDb(defaultData);
    }
  } else if (!fs.existsSync(dbPath)) {
    saveDb(defaultData);
  }
  return loadDb();
}

function getDb() {
  return loadDb();
}

module.exports = { initDb, getDb, loadDb, saveDb, nextId };
