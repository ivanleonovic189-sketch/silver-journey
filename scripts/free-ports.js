/**
 * Освобождает порты Enter Pay перед dev (Windows).
 */
const { execSync } = require('child_process');

const PORTS = [3002, 5179, 5180, 5181, 5182, 5183, 5184, 5185];
const killed = new Set();

function freePort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && !killed.has(pid)) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          killed.add(pid);
          console.log(`[free-ports] stopped PID ${pid} (port ${port})`);
        } catch {
          /* already dead */
        }
      }
    }
  } catch {
    /* port free */
  }
}

console.log('[free-ports] clearing ports:', PORTS.join(', '));
PORTS.forEach(freePort);
if (killed.size === 0) {
  console.log('[free-ports] all clear');
}