const { loadEnv } = require('./load-env');
loadEnv();

const { initDb, getDb, saveDb, ensureDbReady } = require('./db');
const { getUpdates, deleteWebhook, hasTelegramBot } = require('./telegram');
const { handleUpdate } = require('./telegram-bot');

let offset = 0;

async function pollLoop() {
  while (true) {
    try {
      const updates = await getUpdates(offset, 30);
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update, { getDb, saveDb });
      }
    } catch (err) {
      console.error('Poll error:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function main() {
  if (!hasTelegramBot()) {
    console.error('TELEGRAM_BOT_TOKEN не задан. Добавьте в backend/.env');
    process.exit(1);
  }

  initDb();
  await ensureDbReady();

  console.log('Сбрасываем webhook для локального polling...');
  try {
    await deleteWebhook();
  } catch (err) {
    console.warn('deleteWebhook:', err.message);
  }

  console.log('Enter Pay bot polling. Ctrl+C для остановки.');
  await pollLoop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
