const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

const AUTH_SECRET = process.env.AUTH_SECRET || 'enter-pay-dev-secret';

function createAuthToken(user) {
  const { password, ...publicUser } = user;
  const payload = JSON.stringify({
    user: publicUser,
    exp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function parseAuthToken(token) {
  if (!token || !token.includes('.')) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  try {
    const payloadStr = Buffer.from(token.slice(0, dot), 'base64url').toString();
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payloadStr).digest('hex');
    if (sig !== expected) return null;
    const payload = JSON.parse(payloadStr);
    if (new Date(payload.exp) < new Date()) return null;
    if (!payload.user?.id) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { createAuthToken, parseAuthToken };
