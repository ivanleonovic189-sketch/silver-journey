const { sendMessage, getAppBaseUrl } = require('./telegram');

const DEFAULT_SETTINGS = {
  notifyTelegramPayouts: true,
  notifyTelegramAppeals: true,
  notifyMinAmount: 0,
};

function getUserSettings(user) {
  return { ...DEFAULT_SETTINGS, ...(user?.settings || {}) };
}

function shouldNotify(user, type, amount = 0) {
  if (!user?.telegramChatId) return false;
  const s = getUserSettings(user);
  const min = Number(s.notifyMinAmount) || 0;
  if (amount > 0 && amount < min) return false;
  if (type === 'payout') return s.notifyTelegramPayouts !== false;
  if (type === 'appeal') return s.notifyTelegramAppeals !== false;
  return true;
}

function fmtMoney(n, currency = '₽') {
  return `${Number(n || 0).toLocaleString('ru-RU')} ${currency}`;
}

function appLink(tabOrHash = '') {
  const base = getAppBaseUrl();
  if (!tabOrHash) return base;
  if (tabOrHash.startsWith('#')) return `${base}/${tabOrHash}`;
  if (tabOrHash.startsWith('/?tab=')) {
    const tab = tabOrHash.split('=')[1]?.split('&')[0];
    return tab ? `${base}/#${tab}` : base;
  }
  return `${base}/${tabOrHash.replace(/^\//, '')}`;
}

async function notifyUser(user, text, replyMarkup) {
  if (!user?.telegramChatId) return null;
  return sendMessage(user.telegramChatId, text, { replyMarkup });
}

async function notifyUserById(db, userId, text, replyMarkup) {
  const user = (db.users || []).find((u) => String(u.id) === String(userId));
  if (!user) return null;
  return notifyUser(user, text, replyMarkup);
}

async function notifyMerchants(db, text, options = {}) {
  const { type = 'payout', amount = 0, role = 'merchant' } = options;
  const users = (db.users || []).filter(
    (u) => u.role === role && u.telegramChatId && shouldNotify(u, type, amount)
  );
  await Promise.all(users.map((u) => notifyUser(u, text, options.replyMarkup)));
}

async function notifyNewPayout(db, request) {
  if (!request || request.status !== 'pending') return;
  const method = request.paymentMethod === 'sbp' ? 'СБП' : 'Карта РФ';
  const text = [
    '<b>Новая заявка на выплату</b>',
    `Сумма: <b>${fmtMoney(request.amount, request.currency || '₽')}</b>`,
    `Банк: ${request.bank || 'не указан'}`,
    `Способ: ${method}`,
    `ID: #${request.id}`,
    '',
    'Примите заявку в кабинете или нажмите кнопку ниже.',
  ].join('\n');
  const replyMarkup = {
    inline_keyboard: [[{ text: 'Открыть выплаты', url: appLink('/?tab=payouts') }]],
  };
  await notifyMerchants(db, text, { type: 'payout', amount: request.amount, replyMarkup });
}

async function notifyPayoutAccepted(db, user, request) {
  if (!shouldNotify(user, 'payout', request.amount)) return;
  const expires = request.expiresAt ? new Date(request.expiresAt).toLocaleString('ru-RU') : '';
  const text = [
    '<b>Заявка принята в работу</b>',
    `#${request.id} · ${fmtMoney(request.amount, request.currency || '₽')}`,
    expires ? `Оплатить до: ${expires}` : '',
    '',
    'Не забудьте загрузить чек после перевода.',
  ].filter(Boolean).join('\n');
  await notifyUser(user, text, {
    replyMarkup: {
      inline_keyboard: [[{ text: 'Перейти к выплате', url: appLink('/?tab=payouts') }]],
    },
  });
}

async function notifyPayoutCompleted(db, user, request) {
  if (!shouldNotify(user, 'payout', request.amount)) return;
  const text = [
    '<b>Выплата завершена</b>',
    `#${request.id} · ${fmtMoney(request.amount, request.currency || '₽')}`,
    'Награда зачислена на баланс.',
  ].join('\n');
  await notifyUser(user, text);
}

async function notifyAppeal(db, user, transaction) {
  if (!shouldNotify(user, 'appeal', transaction.amount)) return;
  const text = [
    '<b>Новая апелляция</b>',
    `Сделка #${transaction.id}`,
    `Сумма: ${fmtMoney(transaction.amount, transaction.currency || '₽')}`,
    '',
    'Проверьте раздел апелляций.',
  ].join('\n');
  await notifyUser(user, text, {
    replyMarkup: {
      inline_keyboard: [[{ text: 'Открыть апелляции', url: appLink('/?tab=appeals') }]],
    },
  });
}

module.exports = {
  notifyUser,
  notifyUserById,
  notifyMerchants,
  notifyNewPayout,
  notifyPayoutAccepted,
  notifyPayoutCompleted,
  notifyAppeal,
  shouldNotify,
  fmtMoney,
  appLink,
};
