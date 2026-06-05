const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '../backend/.env');
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

const arg = process.argv[2];
const api = process.argv[3] || process.env.PUBLIC_APP_URL || 'http://localhost:3002';

if (!arg) {
  console.error('Usage: node scripts/verify-shop-user.js EMAIL | USER_ID | EP-CODE [API_URL]');
  process.exit(1);
}

const secret = process.env.ADMIN_VERIFY_SECRET;
if (!secret) {
  console.error('Set ADMIN_VERIFY_SECRET in backend/.env');
  process.exit(1);
}

async function main() {
  let body;
  if (String(arg).toUpperCase().startsWith('EP-')) {
    body = { verificationCode: String(arg).trim().toUpperCase() };
  } else if (String(arg).includes('@')) {
    body = { email: arg };
  } else {
    body = { userId: Number(arg) };
  }
  const res = await fetch(`${api.replace(/\/$/, '')}/api/admin/verify-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(res.status, JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
