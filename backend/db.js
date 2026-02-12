const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'payments.json');

const defaultData = {
  transactions: [],
  paymentMethods: [],
  merchants: [],
  kycVerifications: [],
  users: [],
  sessions: [],
  payoutRequests: [],
  config: { name: 'Ship Pay', currency: '₽' },
};

function nextId(arr) {
  const max = arr.length ? Math.max(...arr.map((x) => x.id)) : 0;
  return max + 1;
}

function loadDb() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { ...defaultData };
  }
}

function saveDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

function initDb() {
  if (!fs.existsSync(dbPath)) {
    saveDb(defaultData);
  }
  return loadDb();
}

function getDb() {
  return loadDb();
}

module.exports = { initDb, getDb, loadDb, saveDb, nextId };
