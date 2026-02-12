import { useState, useEffect } from 'react';
import { API } from './api';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Deals from './components/Deals';
import Appeals from './components/Appeals';
import Payouts from './components/Payouts';
import History from './components/History';
import TopNav from './components/TopNav';
import Loader from './components/Loader';
import WalletModal from './components/WalletModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const validTabs = ['dashboard', 'deals', 'appeals', 'payouts', 'history', 'devices', 'pay', 'ref', 'settings', 'merchants', 'transactions', 'stats'];
  const [activeTab, setActiveTabState] = useState(() => {
    const hash = window.location.hash.slice(1) || 'dashboard';
    return validTabs.includes(hash) ? hash : 'dashboard';
  });
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    window.location.hash = validTabs.includes(tab) ? tab : '';
  };

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (validTabs.includes(hash)) setActiveTabState(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [usdtRate, setUsdtRate] = useState(() => {
    // Загружаем сохраненный курс из localStorage при инициализации
    const savedRate = localStorage.getItem('shipPayUsdtRate');
    return savedRate ? parseFloat(savedRate) : null;
  });
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('shipPayTheme');
    return savedTheme || 'dark'; // Дефолт - темная тема
  });
  const [showMerchantForm, setShowMerchantForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showUserDepositForm, setShowUserDepositForm] = useState(false);
  const [showUserWithdrawForm, setShowUserWithdrawForm] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    merchantId: '',
    userId: '',
    amount: '',
    paymentMethod: '',
    accountDetails: '',
  });

  // Получение курса USDT
  const fetchUsdtRate = async () => {
    try {
      // Используем OKX API для получения курса USDT к RUB
      // Получаем курс USDT/USD и USD/RUB, затем вычисляем USDT/RUB
      const usdtUsdResponse = await fetch('https://www.okx.com/api/v5/market/ticker?instId=USDT-USDT');
      const usdtUsdData = await usdtUsdResponse.json();
      
      if (usdtUsdData.data && usdtUsdData.data[0]) {
        const usdtUsdPrice = parseFloat(usdtUsdData.data[0].last) || 1;
        
        // Получаем курс USD/RUB через Центральный банк РФ или альтернативный источник
        const usdRubResponse = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
        const usdRubData = await usdRubResponse.json();
        
        if (usdRubData.Valute && usdRubData.Valute.USD) {
          const usdRubRate = usdRubData.Valute.USD.Value;
          const usdtRubRate = usdtUsdPrice * usdRubRate;
          setUsdtRate(usdtRubRate);
          // Сохраняем курс в localStorage
          localStorage.setItem('shipPayUsdtRate', usdtRubRate.toString());
        } else {
          throw new Error('Курс USD/RUB не найден');
        }
      } else {
        throw new Error('Курс USDT не найден');
      }
    } catch (error) {
      console.error('Ошибка получения курса USDT:', error);
      try {
        // Альтернативный способ через CoinGecko
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub');
        const data = await response.json();
        if (data.tether && data.tether.rub) {
          setUsdtRate(data.tether.rub);
          // Сохраняем курс в localStorage
          localStorage.setItem('shipPayUsdtRate', data.tether.rub.toString());
        } else {
          throw new Error('Курс не найден');
        }
      } catch (altError) {
        console.error('Ошибка альтернативного получения курса:', altError);
        // Не устанавливаем дефолтное значение при ошибке
        setUsdtRate(null);
      }
    }
  };

  // Автообновление курса USDT каждые 5 минут (без обновления при F5)
  useEffect(() => {
    // Загружаем курс только если его нет в localStorage (первый запуск)
    const savedRate = localStorage.getItem('shipPayUsdtRate');
    if (!savedRate) {
      fetchUsdtRate();
    }
    // Запускаем интервал обновления каждые 5 минут
    const interval = setInterval(fetchUsdtRate, 300000); // Обновление каждые 5 минут
    return () => clearInterval(interval);
  }, []);

  // Применение темы при загрузке и изменении
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('shipPayTheme', theme);
  }, [theme]);

  // Применение сохраненной темы при первой загрузке
  useEffect(() => {
    const savedTheme = localStorage.getItem('shipPayTheme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Проверка авторизации при загрузке
  useEffect(() => {
    const savedToken = localStorage.getItem('shipPayToken');
    const savedUser = localStorage.getItem('shipPayUser');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Загрузка данных после авторизации
  useEffect(() => {
    if (token && user) {
      fetchMerchants();
      fetchPaymentMethods();
      fetchStats();
      fetchTransactions();
      fetchPayoutRequests();
      const interval = setInterval(() => {
        fetchMerchants();
        fetchStats();
        fetchTransactions();
        fetchPayoutRequests();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [token, user]);

  const verifyToken = async (authToken) => {
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'x-auth-token': authToken,
        },
      });
      
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setLoading(false);
      } else {
        localStorage.removeItem('shipPayToken');
        localStorage.removeItem('shipPayUser');
        setToken(null);
        setUser(null);
        setLoading(false);
      }
    } catch (err) {
      localStorage.removeItem('shipPayToken');
      localStorage.removeItem('shipPayUser');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-auth-token': token,
        },
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    
    localStorage.removeItem('shipPayToken');
    localStorage.removeItem('shipPayUser');
    setUser(null);
    setToken(null);
  };

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'x-auth-token': token,
    'Content-Type': 'application/json',
  });

  const fetchMerchants = async () => {
    try {
      const res = await fetch(`${API}/api/merchants`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMerchants(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch merchants:', err);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch(`${API}/api/payment-methods`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data);
      }
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/api/stats`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${API}/api/transactions`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.slice(-50).reverse());
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  };

  const fetchPayoutRequests = async () => {
    try {
      const res = await fetch(`${API}/api/payout-requests`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPayoutRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch payout requests:', err);
    }
  };

  const handleAcceptPayout = async (id) => {
    try {
      const res = await fetch(`${API}/api/payout-requests/${id}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        fetchPayoutRequests();
        fetchStats();
        return data;
      }
      const err = await res.json();
      showToast(err.error || 'Ошибка', 'error');
      return null;
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
      return null;
    }
  };

  const handleCompletePayout = async (id, receiptBase64) => {
    try {
      const res = await fetch(`${API}/api/payout-requests/${id}/complete`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ receiptBase64 }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Выплата завершена! +${data.rewardAmount?.toLocaleString()} ₽ на баланс`, 'success');
        fetchPayoutRequests();
        fetchStats();
        return true;
      }
      const err = await res.json();
      showToast(err.error || 'Ошибка', 'error');
      return false;
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
      return false;
    }
  };

  const handleCancelPayout = async (id) => {
    try {
      const res = await fetch(`${API}/api/payout-requests/${id}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast('Заявка отменена', 'success');
        fetchPayoutRequests();
      }
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? 'var(--green)' : 'var(--red)'};
      color: ${type === 'success' ? '#000' : '#fff'};
      border-radius: 10px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const handleCreateMerchant = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/merchants`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: formData.name }),
      });
      if (res.ok) {
        const merchant = await res.json();
        showToast(`Мерчант "${merchant.name}" создан`, 'success');
        setShowMerchantForm(false);
        setFormData({ ...formData, name: '' });
        fetchMerchants();
      } else {
        const err = await res.json();
        showToast(err.error || 'Ошибка создания мерчанта', 'error');
      }
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
    }
  };

  const handleMerchantDeposit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/merchants/${formData.merchantId}/deposit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount: formData.amount, paymentMethod: formData.paymentMethod }),
      });
      if (res.ok) {
        showToast(`Депозит ${formData.amount} ₽ создан`, 'success');
        setShowDepositForm(false);
        setFormData({ ...formData, merchantId: '', amount: '', paymentMethod: '' });
        fetchMerchants();
        fetchStats();
        fetchTransactions();
      } else {
        const err = await res.json();
        showToast(err.error || 'Ошибка создания депозита', 'error');
      }
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
    }
  };

  const handleUserDeposit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/transactions/deposit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          merchantId: formData.merchantId,
          userId: formData.userId,
          amount: formData.amount,
          currency: '₽',
          paymentMethod: formData.paymentMethod,
        }),
      });
      if (res.ok) {
        const tx = await res.json();
        showToast(`Депозит пользователя #${tx.id} создан`, 'success');
        setShowUserDepositForm(false);
        setFormData({ ...formData, merchantId: '', userId: '', amount: '', paymentMethod: '' });
        fetchStats();
        fetchTransactions();
      } else {
        const err = await res.json();
        showToast(err.error || 'Ошибка создания депозита', 'error');
      }
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
    }
  };

  const handleUserWithdraw = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/transactions/withdraw`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          merchantId: formData.merchantId,
          userId: formData.userId,
          amount: formData.amount,
          currency: '₽',
          paymentMethod: formData.paymentMethod,
          accountDetails: formData.accountDetails,
        }),
      });
      if (res.ok) {
        const tx = await res.json();
        showToast(`Вывод пользователя #${tx.id} создан`, 'success');
        setShowUserWithdrawForm(false);
        setFormData({ ...formData, merchantId: '', userId: '', amount: '', paymentMethod: '', accountDetails: '' });
        fetchMerchants();
        fetchStats();
        fetchTransactions();
      } else {
        const err = await res.json();
        showToast(err.error || 'Ошибка создания вывода', 'error');
      }
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
    }
  };

  const handleUpdateTransaction = async (txId, status) => {
    try {
      const res = await fetch(`${API}/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showToast(`Транзакция ${status === 'completed' ? 'завершена' : 'отклонена'}`, 'success');
        fetchMerchants();
        fetchStats();
        fetchTransactions();
      } else {
        const err = await res.json();
        showToast(err.error || 'Ошибка обновления транзакции', 'error');
      }
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error');
    }
  };

  // Если не авторизован, показываем форму авторизации
  if (!user || !token) {
    return <Auth onLogin={handleLogin} />;
  }

  // Если загружается, показываем прелоадер
  if (loading) {
    return <Loader user={user} />;
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Верхняя навигация */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        user={user}
        balance={stats?.balance ?? stats?.totalAmount}
        onWalletClick={() => setShowWalletModal(true)}
        theme={theme}
        onThemeToggle={toggleTheme}
      />

      {/* Основной контент */}
      <div style={{ flex: 1, minHeight: 'calc(100vh - 72px)' }}>
        {/* Контент */}
        {activeTab === 'dashboard' && (
          <Dashboard
            user={user}
            stats={stats}
            transactions={transactions}
            merchants={merchants}
            paymentMethods={paymentMethods}
            payoutRequests={payoutRequests}
            onLogout={handleLogout}
            onTabChange={setActiveTab}
            onWalletClick={() => setShowWalletModal(true)}
            usdtRate={usdtRate}
          />
        )}

        {activeTab !== 'dashboard' && (
          <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
            {/* Контент */}
            {activeTab === 'deals' && (
              <Deals
                transactions={transactions}
                paymentMethods={paymentMethods}
                merchants={merchants}
                onUpdateTransaction={handleUpdateTransaction}
              />
            )}
            {activeTab === 'appeals' && (
              <Appeals
                transactions={transactions}
                paymentMethods={paymentMethods}
                merchants={merchants}
                onUpdateTransaction={handleUpdateTransaction}
              />
            )}
            {activeTab === 'payouts' && (
              <Payouts
                payoutRequests={payoutRequests}
                paymentMethods={paymentMethods}
                user={user}
                getAuthHeaders={getAuthHeaders}
                onAccept={handleAcceptPayout}
                onComplete={handleCompletePayout}
                onCancel={handleCancelPayout}
              />
            )}
            {activeTab === 'history' && (
              <History
                payoutRequests={payoutRequests}
                transactions={transactions}
                getAuthHeaders={getAuthHeaders}
                onTabChange={setActiveTab}
                user={user}
              />
            )}
            {(activeTab === 'devices' || activeTab === 'pay' || activeTab === 'ref' || activeTab === 'settings') && (
              <div style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: 'var(--text-muted)',
                fontSize: '1.1rem',
              }}>
                Раздел "{activeTab === 'devices' ? 'Устройства' : activeTab === 'pay' ? 'Pay' : activeTab === 'ref' ? 'Ref' : 'Настройки'}" в разработке
              </div>
            )}
            {activeTab === 'merchants' && (
              <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)' }}>Мерчанты</h2>
              <button
                onClick={() => setShowMerchantForm(!showMerchantForm)}
                style={{
                  padding: '0.875rem 1.75rem',
                  background: 'var(--green)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
              >
                {showMerchantForm ? '✕ Отмена' : '+ Создать мерчанта'}
              </button>
            </div>

            {showMerchantForm && (
              <section style={{
                background: 'var(--bg-card)',
                padding: '2rem',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                marginBottom: '2rem',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
                  Создать мерчанта
                </h3>
                <form onSubmit={handleCreateMerchant} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: '0.5rem',
                      fontWeight: 500,
                    }}>
                      Название
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text)',
                        fontSize: '1rem',
                      }}
                      placeholder="Название мерчанта"
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: '0.875rem 1.75rem',
                      background: 'var(--green)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                    }}
                  >
                    Создать
                  </button>
                </form>
              </section>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}>
              {merchants.map((merchant) => (
                <div
                  key={merchant.id}
                  style={{
                    background: 'var(--bg-card)',
                    padding: '1.75rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1.25rem',
                  }}>
                    <div>
                      <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginBottom: '0.5rem',
                      }}>
                        {merchant.name}
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        ID: {merchant.id}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: merchant.enabled
                          ? 'rgba(0, 255, 136, 0.15)'
                          : 'rgba(239, 83, 80, 0.15)',
                        color: merchant.enabled ? 'var(--green-bright)' : 'var(--red)',
                      }}
                    >
                      {merchant.enabled ? 'Активен' : 'Отключен'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: '0.5rem',
                    }}>
                      Баланс
                    </div>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: 700,
                      color: 'var(--green)',
                    }}>
                      {(merchant.balance || 0).toLocaleString()} ₽
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => {
                        setSelectedMerchant(merchant);
                        setFormData({ ...formData, merchantId: merchant.id });
                        setShowDepositForm(true);
                      }}
                      style={{
                        flex: 1,
                        minWidth: '100px',
                        padding: '0.75rem',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'var(--green)';
                        e.target.style.color = '#000';
                        e.target.style.borderColor = 'var(--green)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'var(--bg-deep)';
                        e.target.style.color = 'var(--text)';
                        e.target.style.borderColor = 'var(--border)';
                      }}
                    >
                      Депозит
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMerchant(merchant);
                        setFormData({ ...formData, merchantId: merchant.id });
                        setShowUserDepositForm(true);
                      }}
                      style={{
                        flex: 1,
                        minWidth: '100px',
                        padding: '0.75rem',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'var(--green)';
                        e.target.style.color = '#000';
                        e.target.style.borderColor = 'var(--green)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'var(--bg-deep)';
                        e.target.style.color = 'var(--text)';
                        e.target.style.borderColor = 'var(--border)';
                      }}
                    >
                      Принять депозит
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMerchant(merchant);
                        setFormData({ ...formData, merchantId: merchant.id });
                        setShowUserWithdrawForm(true);
                      }}
                      style={{
                        flex: 1,
                        minWidth: '100px',
                        padding: '0.75rem',
                        background: 'var(--bg-deep)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        color: 'var(--text)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'var(--green)';
                        e.target.style.color = '#000';
                        e.target.style.borderColor = 'var(--green)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'var(--bg-deep)';
                        e.target.style.color = 'var(--text)';
                        e.target.style.borderColor = 'var(--border)';
                      }}
                    >
                      Вывод
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
            )}

            {/* Вкладка Транзакции */}
            {activeTab === 'transactions' && (
          <section style={{
            background: 'var(--bg-card)',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '1.5rem',
            }}>
              Транзакции
            </h2>
            {transactions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--text-muted)',
              }}>
                Транзакций пока нет
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      padding: '1.25rem',
                      background: 'var(--bg-deep)',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-deep)';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginBottom: '0.5rem',
                        fontSize: '1rem',
                      }}>
                        #{tx.id} • {tx.type === 'deposit' ? 'Депозит' : tx.type === 'withdraw' ? 'Вывод' : 'Депозит мерчанта'}
                        {tx.direction === 'in' && ' →'} {tx.direction === 'out' && ' ←'}
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                      }}>
                        Мерчант #{tx.merchantId} {tx.userId && `• Пользователь ${tx.userId}`} • {tx.paymentMethod} • {new Date(tx.createdAt).toLocaleString('ru')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginRight: '1.5rem' }}>
                      <div style={{
                        fontWeight: 700,
                        color: 'var(--text)',
                        fontSize: '1.25rem',
                      }}>
                        {tx.amount.toLocaleString()} {tx.currency || '₽'}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background:
                          tx.status === 'completed'
                            ? 'rgba(0, 255, 136, 0.15)'
                            : tx.status === 'pending'
                            ? 'rgba(255, 184, 77, 0.15)'
                            : 'rgba(239, 83, 80, 0.15)',
                        color:
                          tx.status === 'completed'
                            ? 'var(--green-bright)'
                            : tx.status === 'pending'
                            ? 'var(--yellow)'
                            : 'var(--red)',
                        marginRight: '1rem',
                      }}
                    >
                      {tx.status === 'completed' ? 'Завершена' : tx.status === 'pending' ? 'В обработке' : 'Апелляция'}
                    </div>
                    {tx.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleUpdateTransaction(tx.id, 'completed')}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'var(--green)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleUpdateTransaction(tx.id, 'failed')}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'var(--red)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </section>
            )}

            {/* Вкладка Статистика */}
            {activeTab === 'stats' && stats && (
              <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}>
              {[
                { label: 'Всего транзакций', value: stats.totalTransactions, color: 'var(--text)' },
                { label: 'Общая сумма', value: `${stats.totalAmount.toLocaleString()} ₽`, color: 'var(--green)' },
                { label: 'В обработке', value: stats.pending, color: 'var(--yellow)' },
                { label: 'Успешных', value: stats.completed, color: 'var(--green-bright)' },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-card)',
                    padding: '2rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.75rem',
                    fontWeight: 500,
                  }}>
                    {stat.label}
                  </div>
                  <div style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: stat.color,
                  }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
            {Object.keys(stats.byMethod).length > 0 && (
              <section style={{
                background: 'var(--bg-card)',
                padding: '2rem',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: '1.5rem',
                }}>
                  По методам оплаты
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(stats.byMethod).map(([method, data]) => (
                    <div
                      key={method}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'var(--bg-deep)',
                        borderRadius: '12px',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-card-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-deep)';
                      }}
                    >
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{method}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {data.count} транзакций • {data.amount.toLocaleString()} ₽
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              )}
              </div>
            )}
          </div>
        )}

      {/* Модалки остаются такими же, но с улучшенным дизайном */}
      {/* Модалка: Депозит на счет мерчанта */}
      {showDepositForm && selectedMerchant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowDepositForm(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              padding: '2.5rem',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '1.5rem',
            }}>
              Депозит на счет мерчанта #{selectedMerchant.id}
            </h3>
            <form onSubmit={handleMerchantDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  Сумма
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                  placeholder="10000"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  Метод оплаты
                </label>
                <select
                  required
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                >
                  <option value="">Выберите метод</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'var(--green)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  Пополнить
                </button>
                <button
                  type="button"
                  onClick={() => setShowDepositForm(false)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Депозит пользователя через мерчанта */}
      {showUserDepositForm && selectedMerchant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowUserDepositForm(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              padding: '2.5rem',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '1.5rem',
            }}>
              Принять депозит пользователя (Мерчант #{selectedMerchant.id})
            </h3>
            <form onSubmit={handleUserDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  ID пользователя
                </label>
                <input
                  type="text"
                  required
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                  placeholder="123"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  Сумма
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                  placeholder="1000"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  Метод оплаты
                </label>
                <select
                  required
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                >
                  <option value="">Выберите метод</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} {method.fee > 0 && `(${method.fee}% комиссия)`}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'var(--green)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  Создать депозит
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserDepositForm(false)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка: Вывод пользователя через мерчанта */}
      {showUserWithdrawForm && selectedMerchant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowUserWithdrawForm(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              padding: '2.5rem',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '1.5rem',
            }}>
              Вывод пользователя (Мерчант #{selectedMerchant.id})
            </h3>
            <div style={{
              padding: '1rem',
              background: 'rgba(255, 184, 77, 0.1)',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              color: 'var(--yellow)',
            }}>
              Баланс мерчанта: {(selectedMerchant.balance || 0).toLocaleString()} ₽
            </div>
            <form onSubmit={handleUserWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  ID пользователя
                </label>
                <input
                  type="text"
                  required
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                  placeholder="123"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  Сумма
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedMerchant.balance || 0}
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                  placeholder="1000"
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  Метод вывода
                </label>
                <select
                  required
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                >
                  <option value="">Выберите метод</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}>
                  Реквизиты (номер карты/СБП)
                </label>
                <input
                  type="text"
                  required
                  value={formData.accountDetails}
                  onChange={(e) => setFormData({ ...formData, accountDetails: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    color: 'var(--text)',
                    fontSize: '1rem',
                  }}
                  placeholder="+79001234567 или 1234 5678 9012 3456"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'var(--green)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  Создать вывод
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserWithdrawForm(false)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'var(--bg-deep)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка кошелька */}
      {showWalletModal && (
        <WalletModal
          user={user}
          stats={stats}
          onClose={() => setShowWalletModal(false)}
          onReplenish={() => {
            setShowWalletModal(false);
            setActiveTab('pay');
          }}
          onWithdraw={() => {
            setShowWalletModal(false);
            setActiveTab('payouts');
          }}
        />
      )}
      </div>
      {/* CSS для анимаций */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
