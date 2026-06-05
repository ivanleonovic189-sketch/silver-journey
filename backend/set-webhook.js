const { loadEnv } = require('./load-env');
loadEnv();

const { setWebhook, getWebhookInfo, getAppBaseUrl, hasTelegramBot } = require('./telegram');

async function main() {
  if (!hasTelegramBot()) {
    console.error('TELEGRAM_BOT_TOKEN не задан.');
    process.exit(1);
  }

  const base = getAppBaseUrl();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const url = `${base}/api/telegram/webhook`;

  console.log('Webhook URL:', url);
  if (secret) console.log('Secret token: (задан)');

  await setWebhook(url, secret || undefined);
  const info = await getWebhookInfo();
  console.log(JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
