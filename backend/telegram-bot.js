const crypto = require('crypto');
const { sendMessage, getBotUsername, getAppBaseUrl } = require('./telegram');
const { fmtMoney, appLink } = require('./telegram-notify');

const LINK_CODE_TTL_MS = 15 * 60 * 1000;

function generateLinkCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function findUserByChatId(db, chatId) {
  return (db.users || []).find((u) => String(u.telegramChatId) === String(chatId));
}

function findUserByLinkCode(db, code) {
  const norm = String(code || '').trim().toUpperCase();
  if (!norm) return null;
  const now = Date.now();
  return (db.users || []).find((u) => {
    if (!u.telegramLinkCode || u.telegramLinkCode !== norm) return false;
    if (u.telegramLinkCodeExpires && new Date(u.telegramLinkCodeExpires).getTime() < now) return false;
    return true;
  });
}

function linkTelegramUser(db, user, chatId, from) {
  user.telegramChatId = String(chatId);
  user.telegramLinkedAt = new Date().toISOString();
  user.telegramLinkCode = null;
  user.telegramLinkCodeExpires = null;
  if (from?.username && !user.telegram.startsWith('@')) {
    user.telegram = `@${from.username}`;
  }
}

function createLinkCodeForUser(user) {
  const code = generateLinkCode();
  user.telegramLinkCode = code;
  user.telegramLinkCodeExpires = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
  return code;
}

function getUserMerchant(db, userId) {
  return (db.merchants || []).find((m) => String(m.userId) === String(userId));
}

function getUserStats(db, user) {
  const merchant = getUserMerchant(db, user.id);
  const balance = merchant?.balance ?? 0;
  const transactions = (db.transactions || []).filter(
    (t) => String(t.merchantId) === String(merchant?.id)
  );
  const payoutRequests = db.payoutRequests || [];
  const pendingPayouts = payoutRequests.filter((r) => r.status === 'pending').length;
  const myInProgress = payoutRequests.filter(
    (r) => r.status === 'in_progress' && String(r.traderId) === String(user.id)
  ).length;
  const appeals = transactions.filter((t) => t.status === 'failed').length;
  return { balance, pendingPayouts, myInProgress, appeals, merchant };
}

function helpText() {
  return [
    '<b>Enter Pay Bot</b>',
    '',
    '/balance - баланс',
    '/stats - сводка',
    '/payouts - новые выплаты',
    '/link КОД - привязка аккаунта',
    '/unlink - отвязать Telegram',
    '/help - эта справка',
  ].join('\n');
}

async function sendWelcome(chatId, linked) {
  const bot = getBotUsername();
  const site = getAppBaseUrl();
  const lines = [
    '<b>Enter Pay Bot</b>',
    linked ? 'Аккаунт привязан. Уведомления включены.' : 'Привяжите аккаунт Enter Pay для алертов и быстрых команд.',
    '',
    linked ? 'Команды: /balance /stats /payouts /help' : `1. Откройте Настройки на сайте\n2. Получите код\n3. Отправьте /link КОД\n\nИли: t.me/${bot}?start=link_КОД`,
    '',
    `Кабинет: ${site}`,
  ];
  await sendMessage(chatId, lines.join('\n'));
}

async function handleLink(db, saveDb, chatId, code, from) {
  const existing = findUserByChatId(db, chatId);
  if (existing) {
    await sendMessage(chatId, `Этот Telegram уже привязан к <b>${existing.name}</b>.\n/unlink чтобы отвязать.`);
    return;
  }
  const user = findUserByLinkCode(db, code);
  if (!user) {
    await sendMessage(chatId, 'Код не найден или истёк. Получите новый код в Настройках на сайте.');
    return;
  }
  linkTelegramUser(db, user, chatId, from);
  saveDb(db);
  await sendMessage(chatId, `Готово! Аккаунт <b>${user.name}</b> привязан.\n\n/balance /stats /payouts`);
}

async function handleCommand(db, saveDb, msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  if (!chatId || !text.startsWith('/')) return;

  const parts = text.split(/\s+/);
  const cmd = parts[0].split('@')[0].toLowerCase();
  const arg = parts.slice(1).join(' ').trim();

  if (cmd === '/start') {
    if (arg.startsWith('link_')) {
      await handleLink(db, saveDb, chatId, arg.slice(5), msg.from);
      return;
    }
    const user = findUserByChatId(db, chatId);
    await sendWelcome(chatId, Boolean(user));
    return;
  }

  if (cmd === '/link') {
    if (!arg) {
      await sendMessage(chatId, 'Укажите код: /link AB12CD\nКод выдаётся в Настройках Enter Pay.');
      return;
    }
    await handleLink(db, saveDb, chatId, arg, msg.from);
    return;
  }

  if (cmd === '/help') {
    await sendMessage(chatId, helpText());
    return;
  }

  const user = findUserByChatId(db, chatId);
  if (!user) {
    await sendMessage(chatId, 'Сначала привяжите аккаунт: /link КОД\nКод в разделе Настройки на сайте.');
    return;
  }

  if (cmd === '/unlink') {
    user.telegramChatId = null;
    user.telegramLinkedAt = null;
    saveDb(db);
    await sendMessage(chatId, 'Telegram отвязан от Enter Pay.');
    return;
  }

  if (cmd === '/balance') {
    const { balance } = getUserStats(db, user);
    await sendMessage(chatId, `Баланс: <b>${fmtMoney(balance)}</b>`);
    return;
  }

  if (cmd === '/stats') {
    const s = getUserStats(db, user);
    await sendMessage(
      chatId,
      [
        `<b>${user.name}</b>`,
        `Баланс: <b>${fmtMoney(s.balance)}</b>`,
        `Новых выплат: ${s.pendingPayouts}`,
        `В работе (ваши): ${s.myInProgress}`,
        `Апелляций: ${s.appeals}`,
      ].join('\n'),
      {
        replyMarkup: {
          inline_keyboard: [[{ text: 'Открыть кабинет', url: appLink('/') }]],
        },
      }
    );
    return;
  }

  if (cmd === '/payouts') {
    const pending = (db.payoutRequests || [])
      .filter((r) => r.status === 'pending')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    if (!pending.length) {
      await sendMessage(chatId, 'Сейчас нет новых заявок на выплату.');
      return;
    }
    const lines = pending.map(
      (r) =>
        `#${r.id} · ${fmtMoney(r.amount, r.currency || '₽')} · ${r.bank || ''} · ${r.paymentMethod === 'sbp' ? 'СБП' : 'Карта'}`
    );
    await sendMessage(
      chatId,
      ['<b>Новые выплаты</b>', ...lines, '', `Всего pending: ${(db.payoutRequests || []).filter((r) => r.status === 'pending').length}`].join('\n'),
      {
        replyMarkup: {
          inline_keyboard: [[{ text: 'Принять выплату', url: appLink('/?tab=payouts') }]],
        },
      }
    );
    return;
  }

  await sendMessage(chatId, 'Неизвестная команда. /help');
}

async function handleUpdate(update, ctx) {
  const { getDb, saveDb } = ctx;
  const db = getDb();
  if (update.message) {
    await handleCommand(db, saveDb, update.message);
  }
}

module.exports = {
  handleUpdate,
  generateLinkCode,
  createLinkCodeForUser,
  findUserByChatId,
  linkTelegramUser,
  LINK_CODE_TTL_MS,
};
