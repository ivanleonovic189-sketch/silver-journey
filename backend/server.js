const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { initDb, getDb, saveDb, nextId } = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5179'] }));
app.use(express.json());

initDb();

// ========== АВТОРИЗАЦИЯ ==========

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  const db = getDb();
  const session = db.sessions?.find(s => s.token === token && s.expiresAt > new Date().toISOString());
  if (!session) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
  
  const user = db.users?.find(u => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }
  
  req.user = user;
  req.session = session;
  next();
}

// Регистрация
app.post('/api/auth/register', (req, res) => {
  const db = getDb();
  const { email, password, name, telegram, role } = req.body || {};
  
  if (!email || !password || !name || !telegram || !role) {
    return res.status(400).json({ error: 'Укажите email, password, name, telegram и role' });
  }
  
  if (role !== 'merchant' && role !== 'shop') {
    return res.status(400).json({ error: 'Роль должна быть "merchant" или "shop"' });
  }
  
  if (!Array.isArray(db.users)) db.users = [];
  
  // Проверка существующего пользователя
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
  }
  
  const user = {
    id: nextId(db.users),
    email: String(email).toLowerCase().trim(),
    password: crypto.createHash('sha256').update(String(password)).digest('hex'),
    name: String(name),
    telegram: String(telegram).trim(),
    role: String(role), // 'merchant' или 'shop'
    createdAt: new Date().toISOString(),
  };
  
  db.users.push(user);
  saveDb(db);
  
  // Создаем сессию
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 дней
  
  if (!Array.isArray(db.sessions)) db.sessions = [];
  db.sessions.push({
    token,
    userId: user.id,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  saveDb(db);
  
  const { password: _, ...userPublic } = user;
  res.status(201).json({ user: userPublic, token });
});

// Логин
app.post('/api/auth/login', (req, res) => {
  const db = getDb();
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и password' });
  }
  
  if (!Array.isArray(db.users)) db.users = [];
  const user = db.users.find(u => u.email === String(email).toLowerCase().trim());
  
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  
  const passwordHash = crypto.createHash('sha256').update(String(password)).digest('hex');
  if (user.password !== passwordHash) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  
  // Создаем сессию
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 дней
  
  if (!Array.isArray(db.sessions)) db.sessions = [];
  // Удаляем старые сессии этого пользователя
  db.sessions = db.sessions.filter(s => s.userId !== user.id || s.expiresAt > new Date().toISOString());
  db.sessions.push({
    token,
    userId: user.id,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  saveDb(db);
  
  const { password: _, ...userPublic } = user;
  res.json({ user: userPublic, token });
});

// Получить текущего пользователя
app.get('/api/auth/me', requireAuth, (req, res) => {
  const { password: _, ...userPublic } = req.user;
  res.json({ user: userPublic });
});

// Выход
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const db = getDb();
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'];
  
  if (Array.isArray(db.sessions)) {
    db.sessions = db.sessions.filter(s => s.token !== token);
    saveDb(db);
  }
  
  res.json({ success: true });
});

// ========== МЕРЧАНТЫ ==========

// Получить список мерчантов
app.get('/api/merchants', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  const merchants = db.merchants || [];
  res.json(merchants.map(m => {
    const { apiKey, ...publicMerchant } = m;
        return publicMerchant;
      }));
});

// Создать мерчанта
app.post('/api/merchants', requireAuth, (req, res) => {
  const db = getDb();
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Укажите name' });
  
  const merchant = {
    id: nextId(db.merchants || []),
    name: String(name),
    apiKey: 'merchant_' + crypto.randomBytes(16).toString('hex'),
    balance: 0,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  
  if (!Array.isArray(db.merchants)) db.merchants = [];
  db.merchants.push(merchant);
  saveDb(db);
  
  res.status(201).json(merchant);
});

// Получить мерчанта по ID
app.get('/api/merchants/:id', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
  
  const merchant = db.merchants.find(m => m.id === id);
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  
  const { apiKey, ...publicMerchant } = merchant;
  res.json(publicMerchant);
});

// Депозит на счет мерчанта (мерчант сам пополняет свой баланс)
app.post('/api/merchants/:id/deposit', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  const id = parseInt(req.params.id, 10);
  const { amount, paymentMethod } = req.body || {};
  
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Укажите amount > 0' });
  
  const merchant = db.merchants.find(m => m.id === id);
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  if (!merchant.enabled) return res.status(400).json({ error: 'Мерчант отключен' });
  
  merchant.balance = (merchant.balance || 0) + Number(amount);
  
  const transaction = {
    id: nextId(db.transactions || []),
    merchantId: String(id),
    type: 'merchant_deposit',
    amount: Number(amount),
    currency: '₽',
    paymentMethod: paymentMethod || 'manual',
    status: 'completed',
    createdAt: new Date().toISOString(),
    metadata: { description: 'Депозит на счет мерчанта' },
  };
  
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(transaction);
  saveDb(db);
  
  const { apiKey, ...publicMerchant } = merchant;
  res.json({ merchant: publicMerchant, transaction });
});

// ========== ПЛАТЕЖИ ЧЕРЕЗ МЕРЧАНТОВ ==========

// Инициализация методов оплаты (только СБП и карта РФ для мерчантов)
function initPaymentMethods(db) {
  if (!Array.isArray(db.paymentMethods) || db.paymentMethods.length === 0) {
    db.paymentMethods = [
      { id: 'card_ru', name: 'Банковская карта РФ', type: 'card', enabled: true, fee: 2.5, min: 100, max: 500000 },
      { id: 'sbp', name: 'СБП (Система быстрых платежей)', type: 'bank', enabled: true, fee: 0.5, min: 10, max: 100000 },
    ];
    saveDb(db);
  }
}

// Инициализация тестового мерчанта
function initMerchants(db) {
  if (!Array.isArray(db.merchants) || db.merchants.length === 0) {
    db.merchants = [
      {
        id: 1,
        name: 'Тестовый мерчант',
        apiKey: 'test_merchant_key_' + crypto.randomBytes(16).toString('hex'),
        balance: 0,
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    ];
    saveDb(db);
  }
}

// Получить список методов оплаты (только СБП и карта РФ)
app.get('/api/payment-methods', requireAuth, (req, res) => {
  const db = getDb();
  initPaymentMethods(db);
  res.json(db.paymentMethods.filter(m => m.enabled));
});

// Создать транзакцию депозита (пользователь пополняет через мерчанта)
app.post('/api/transactions/deposit', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  initPaymentMethods(db);
  const { merchantId, userId, amount, currency, paymentMethod, metadata } = req.body || {};
  
  if (!merchantId || !userId || !amount || !currency || !paymentMethod) {
    return res.status(400).json({ error: 'Укажите merchantId, userId, amount, currency, paymentMethod' });
  }
  
  const merchant = db.merchants.find(m => m.id === parseInt(merchantId, 10));
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  if (!merchant.enabled) return res.status(400).json({ error: 'Мерчант отключен' });
  
  const method = db.paymentMethods.find(m => m.id === paymentMethod);
  if (!method || !method.enabled) return res.status(400).json({ error: 'Метод оплаты недоступен' });
  
  const amountNum = Number(amount);
  if (amountNum < method.min || amountNum > method.max) {
    return res.status(400).json({ error: `Сумма должна быть от ${method.min} до ${method.max}` });
  }
  
  const transaction = {
    id: nextId(db.transactions || []),
    merchantId: String(merchantId),
    userId: String(userId),
    amount: amountNum,
    currency: String(currency),
    paymentMethod: String(paymentMethod),
    status: 'pending',
    type: 'deposit',
    direction: 'in', // входящий платеж к мерчанту
    createdAt: new Date().toISOString(),
    metadata: metadata || {},
  };
  
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(transaction);
  saveDb(db);
  
  res.status(201).json(transaction);
});

// Создать транзакцию вывода (пользователь выводит через мерчанта)
app.post('/api/transactions/withdraw', requireAuth, (req, res) => {
  const db = getDb();
  initMerchants(db);
  initPaymentMethods(db);
  const { merchantId, userId, amount, currency, paymentMethod, accountDetails, metadata } = req.body || {};
  
  if (!merchantId || !userId || !amount || !currency || !paymentMethod || !accountDetails) {
    return res.status(400).json({ error: 'Укажите merchantId, userId, amount, currency, paymentMethod, accountDetails' });
  }
  
  const merchant = db.merchants.find(m => m.id === parseInt(merchantId, 10));
  if (!merchant) return res.status(404).json({ error: 'Мерчант не найден' });
  if (!merchant.enabled) return res.status(400).json({ error: 'Мерчант отключен' });
  
  const method = db.paymentMethods.find(m => m.id === paymentMethod);
  if (!method || !method.enabled) return res.status(400).json({ error: 'Метод оплаты недоступен' });
  
  const amountNum = Number(amount);
  if (amountNum < method.min || amountNum > method.max) {
    return res.status(400).json({ error: `Сумма должна быть от ${method.min} до ${method.max}` });
  }
  
  // Проверка баланса мерчанта (для вывода нужен баланс)
  if ((merchant.balance || 0) < amountNum) {
    return res.status(400).json({ error: 'Недостаточно средств на счете мерчанта' });
  }
  
  const transaction = {
    id: nextId(db.transactions || []),
    merchantId: String(merchantId),
    userId: String(userId),
    amount: amountNum,
    currency: String(currency),
    paymentMethod: String(paymentMethod),
    status: 'pending',
    type: 'withdraw',
    direction: 'out', // исходящий платеж от мерчанта
    accountDetails: accountDetails,
    createdAt: new Date().toISOString(),
    metadata: metadata || {},
  };
  
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(transaction);
  saveDb(db);
  
  res.status(201).json(transaction);
});

// Получить транзакции
app.get('/api/transactions', requireAuth, (req, res) => {
  const db = getDb();
  const { merchantId, userId, status } = req.query;
  let transactions = db.transactions || [];
  
  if (merchantId) transactions = transactions.filter(t => t.merchantId === merchantId);
  if (userId) transactions = transactions.filter(t => t.userId === userId);
  if (status) transactions = transactions.filter(t => t.status === status);
  
  res.json(transactions);
});

// Обновить статус транзакции
app.patch('/api/transactions/:id', requireAuth, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const { status, error } = req.body || {};
  
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });
  
  const transaction = db.transactions.find(t => t.id === id);
  if (!transaction) return res.status(404).json({ error: 'Транзакция не найдена' });
  
  const oldStatus = transaction.status;
  
  if (status) {
    transaction.status = status;
    if (status === 'completed' || status === 'failed') {
      transaction.updatedAt = new Date().toISOString();
    }
    
    // Обновление баланса мерчанта при завершении транзакции
    if (status === 'completed' && oldStatus !== 'completed') {
      const merchant = db.merchants.find(m => m.id === parseInt(transaction.merchantId, 10));
      if (merchant) {
        if (transaction.type === 'deposit' && transaction.direction === 'in') {
          // Депозит пользователя: мерчант получает деньги (увеличивает баланс)
          merchant.balance = (merchant.balance || 0) + transaction.amount;
        } else if (transaction.type === 'withdraw' && transaction.direction === 'out') {
          // Вывод пользователя: мерчант отправляет деньги (уменьшает баланс)
          merchant.balance = (merchant.balance || 0) - transaction.amount;
        }
        saveDb(db);
      }
    }
    
    // Откат баланса при отмене завершенной транзакции
    if ((status === 'failed' || status === 'pending') && oldStatus === 'completed') {
      const merchant = db.merchants.find(m => m.id === parseInt(transaction.merchantId, 10));
      if (merchant) {
        if (transaction.type === 'deposit' && transaction.direction === 'in') {
          merchant.balance = (merchant.balance || 0) - transaction.amount;
        } else if (transaction.type === 'withdraw' && transaction.direction === 'out') {
          merchant.balance = (merchant.balance || 0) + transaction.amount;
        }
        saveDb(db);
      }
    }
  }
  if (error) transaction.error = String(error);
  
  saveDb(db);
  res.json(transaction);
});

// KYC верификация
app.post('/api/kyc/verify', requireAuth, (req, res) => {
  const db = getDb();
  const { userId, documents, personalInfo } = req.body || {};
  
  if (!userId) return res.status(400).json({ error: 'Укажите userId' });
  
  const verification = {
    id: nextId(db.kycVerifications || []),
    userId: String(userId),
    status: 'pending',
    documents: documents || [],
    personalInfo: personalInfo || {},
    createdAt: new Date().toISOString(),
  };
  
  if (!Array.isArray(db.kycVerifications)) db.kycVerifications = [];
  db.kycVerifications.push(verification);
  saveDb(db);
  
  res.status(201).json(verification);
});

// ========== ЗАЯВКИ НА ВЫПЛАТУ (P2P) ==========

const PAYOUT_TIME_LIMIT_MS = 20 * 60 * 1000; // 20 минут
const PAYOUT_COMMISSION_PERCENT = 1;

function initPayoutRequests(db) {
  if (!Array.isArray(db.payoutRequests)) db.payoutRequests = [];
  if (db.payoutRequests.length === 0) {
    db.payoutRequests = [
      { id: 1, amount: 5000, currency: '₽', paymentMethod: 'sbp', bank: 'Сбербанк', requisites: '+7 900 123 45 67', status: 'pending', createdAt: new Date().toISOString() },
      { id: 2, amount: 15000, currency: '₽', paymentMethod: 'card_ru', bank: 'Тинькофф', requisites: '1234 5678 9012 3456', status: 'pending', createdAt: new Date().toISOString() },
      { id: 3, amount: 3000, currency: '₽', paymentMethod: 'sbp', bank: 'ВТБ', requisites: '+7 900 987 65 43', status: 'pending', createdAt: new Date().toISOString() },
      { id: 4, amount: 25000, currency: '₽', paymentMethod: 'card_ru', bank: 'Сбербанк', requisites: '5536 9138 1234 5678', status: 'pending', createdAt: new Date().toISOString() },
      { id: 5, amount: 8000, currency: '₽', paymentMethod: 'sbp', bank: 'Райффайзен', requisites: '+7 916 555 12 34', status: 'pending', createdAt: new Date().toISOString() },
    ];
    saveDb(db);
  }
  // Миграция: добавляем банк к старым записям без банка
  const bankById = { 1: 'Сбербанк', 2: 'Тинькофф', 3: 'ВТБ', 4: 'Сбербанк', 5: 'Райффайзен' };
  let needsSave = false;
  db.payoutRequests.forEach((r) => {
    if (!r.bank) {
      r.bank = bankById[r.id] || (r.paymentMethod === 'sbp' ? 'СБП' : r.paymentMethod === 'card_ru' ? 'Карта' : '');
      needsSave = true;
    }
  });
  if (needsSave) saveDb(db);
}

// Список заявок на выплату (по умолчанию pending, можно status=all для истории)
app.get('/api/payout-requests', requireAuth, (req, res) => {
  const db = getDb();
  initPayoutRequests(db);
  initPaymentMethods(db);
  const { amountFrom, amountTo, status, paymentMethod } = req.query;
  let requests = db.payoutRequests || [];

  if (amountFrom) requests = requests.filter(r => r.amount >= Number(amountFrom));
  if (amountTo) requests = requests.filter(r => r.amount <= Number(amountTo));
  if (status && status !== 'all') requests = requests.filter(r => r.status === status);
  if (paymentMethod) requests = requests.filter(r => r.paymentMethod === paymentMethod);

  requests = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(requests);
});

// Трейдер принимает заявку
app.post('/api/payout-requests/:id/accept', requireAuth, (req, res) => {
  const db = getDb();
  initPayoutRequests(db);
  const id = parseInt(req.params.id, 10);
  const request = db.payoutRequests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Заявка уже занята' });

  request.status = 'in_progress';
  request.traderId = req.user.id;
  request.acceptedAt = new Date().toISOString();
  request.expiresAt = new Date(Date.now() + PAYOUT_TIME_LIMIT_MS).toISOString();
  saveDb(db);
  res.json(request);
});

// Трейдер завершает выплату (загружает чек)
app.patch('/api/payout-requests/:id/complete', requireAuth, (req, res) => {
  const db = getDb();
  initPayoutRequests(db);
  initMerchants(db);
  const id = parseInt(req.params.id, 10);
  const { receiptBase64 } = req.body || {};
  const request = db.payoutRequests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (request.status !== 'in_progress') return res.status(400).json({ error: 'Заявка не в обработке' });
  if (request.traderId !== req.user.id) return res.status(403).json({ error: 'Не ваша заявка' });
  if (!receiptBase64) return res.status(400).json({ error: 'Загрузите чек (PDF, JPG или JPEG)' });

  const now = new Date();
  if (new Date(request.expiresAt) < now) return res.status(400).json({ error: 'Время на оплату истекло' });

  const merchant = db.merchants.find(m => m.id === 1) || db.merchants[0];
  const commission = Math.round(request.amount * (PAYOUT_COMMISSION_PERCENT / 100));
  const rewardAmount = request.amount + commission; // 5000 + 50 = 5050 — зачисляем на баланс

  request.status = 'completed';
  request.completedAt = now.toISOString();
  request.receiptBase64 = receiptBase64;

  // При завершении выплаты зачисляем сумму + 1% на баланс (5050₽ при выплате 5000₽, профит 50₽)
  if (merchant) {
    merchant.balance = (merchant.balance || 0) + rewardAmount;
  }
  const tx = {
    id: nextId(db.transactions || []),
    type: 'payout_reward',
    merchantId: String(merchant?.id || 1),
    amount: rewardAmount,
    baseAmount: request.amount,
    commission,
    currency: '₽',
    status: 'completed',
    payoutRequestId: request.id,
    createdAt: now.toISOString(),
  };
  if (!Array.isArray(db.transactions)) db.transactions = [];
  db.transactions.push(tx);
  saveDb(db);
  res.json({ ...request, rewardAmount });
});

// Трейдер отменяет принятую заявку
app.post('/api/payout-requests/:id/cancel', requireAuth, (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const request = db.payoutRequests.find(r => r.id === id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  if (request.status !== 'in_progress' || request.traderId !== req.user.id) {
    return res.status(400).json({ error: 'Невозможно отменить' });
  }
  request.status = 'cancelled';
  request.cancelledAt = new Date().toISOString();
  request.cancelledBy = req.user.id;
  request.traderId = null;
  request.acceptedAt = null;
  request.expiresAt = null;
  saveDb(db);
  res.json(request);
});

// Получить статистику
app.get('/api/stats', requireAuth, (req, res) => {
  const db = getDb();
  initPayoutRequests(db);
  const transactions = db.transactions || [];
  const payoutRequests = db.payoutRequests || [];
  const merchant = db.merchants?.[0];
  const balance = merchant?.balance ?? 0;

  const insuranceDeposit = transactions
    .filter(t => t.type === 'merchant_deposit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const workingDeposit = transactions
    .filter(t => t.type === 'payout_reward' && t.status === 'completed')
    .reduce((sum, t) => sum + (t.commission ?? Math.round((t.baseAmount ?? t.amount) * 0.01)), 0);
  const pendingPayouts = payoutRequests.filter(r => r.status === 'pending').length;
  const pendingDeals = transactions.filter(t => t.status === 'pending' && t.type === 'deposit' && t.direction === 'in').length;
  const appealsCount = transactions.filter(t => t.status === 'failed').length;

  const stats = {
    totalTransactions: transactions.length,
    totalAmount: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0),
    pending: transactions.filter(t => t.status === 'pending').length,
    completed: transactions.filter(t => t.status === 'completed').length,
    failed: transactions.filter(t => t.status === 'failed').length,
    balance,
    insuranceDeposit,
    workingDeposit,
    payoutCompleted: payoutRequests.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.amount || 0), 0),
    payoutCompletedCount: payoutRequests.filter(r => r.status === 'completed').length,
    pendingPayouts,
    pendingDeals,
    appealsCount,
    byMethod: {},
  };

  transactions.forEach(t => {
    if (!stats.byMethod[t.paymentMethod]) {
      stats.byMethod[t.paymentMethod] = { count: 0, amount: 0 };
    }
    stats.byMethod[t.paymentMethod].count++;
    if (t.status === 'completed') {
      stats.byMethod[t.paymentMethod].amount += t.amount;
    }
  });

  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`Ship Pay Backend: http://localhost:${PORT}`);
});
