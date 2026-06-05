function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function hasTelegramBot() {
  return Boolean(getTelegramBotToken());
}

module.exports = { getTelegramBotToken, hasTelegramBot };
