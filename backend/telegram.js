const BOT_API = 'https://api.telegram.org/bot';

function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function hasTelegramBot() {
  return Boolean(getTelegramBotToken());
}

function getBotApiUrl(method) {
  return `${BOT_API}${getTelegramBotToken()}/${method}`;
}

async function callTelegramApi(method, body = {}) {
  if (!hasTelegramBot()) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  const res = await fetch(getBotApiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram API error: ${method}`);
  }
  return data.result;
}

async function sendMessage(chatId, text, options = {}) {
  if (!chatId || !hasTelegramBot()) return null;
  try {
    return await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options.parseMode || 'HTML',
      disable_web_page_preview: options.disablePreview !== false,
      reply_markup: options.replyMarkup || undefined,
    });
  } catch (err) {
    console.error('Telegram sendMessage failed:', err.message);
    return null;
  }
}

async function setWebhook(url, secretToken) {
  return callTelegramApi('setWebhook', {
    url,
    secret_token: secretToken || undefined,
    allowed_updates: ['message', 'callback_query'],
  });
}

async function deleteWebhook() {
  return callTelegramApi('deleteWebhook', { drop_pending_updates: false });
}

async function getWebhookInfo() {
  return callTelegramApi('getWebhookInfo', {});
}

async function getUpdates(offset, timeout = 30) {
  return callTelegramApi('getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message', 'callback_query'],
  });
}

function getAppBaseUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_URL ||
    'http://localhost:5179'
  ).replace(/\/$/, '');
}

function getBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || 'enterpayrisk_bot';
}

module.exports = {
  getTelegramBotToken,
  hasTelegramBot,
  callTelegramApi,
  sendMessage,
  setWebhook,
  deleteWebhook,
  getWebhookInfo,
  getUpdates,
  getAppBaseUrl,
  getBotUsername,
};
