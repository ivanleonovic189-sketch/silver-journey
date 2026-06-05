import { useState, useEffect, useCallback } from 'react';
import { API } from '../../api';
import ShopTopNav from './ShopTopNav';
import ShopDashboard from './ShopDashboard';
import ShopWithdrawals from './ShopWithdrawals';
import ShopDeposits from './ShopDeposits';
import ShopAnalytics from './ShopAnalytics';
import ShopApi from './ShopApi';
import Settings from '../Settings';
import WelcomeModal from '../WelcomeModal';

const SHOP_TABS = ['overview', 'withdrawals', 'deposits', 'analytics', 'api', 'settings'];

export default function ShopApp({ user, token, onLogout, theme, onThemeToggle, onUserUpdate }) {
  const [activeTab, setActiveTabState] = useState(() => {
    const hash = window.location.hash.slice(1);
    return SHOP_TABS.includes(hash) ? hash : 'overview';
  });
  const [stats, setStats] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    window.location.hash = SHOP_TABS.includes(tab) ? tab : 'overview';
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`,
    'x-auth-token': token,
    'Content-Type': 'application/json',
  });

  const refresh = useCallback(async () => {
    if (!token) return;
    const headers = getAuthHeaders();
    try {
      const [statsRes, payoutsRes, txRes] = await Promise.all([
        fetch(`${API}/api/stats`, { headers }),
        fetch(`${API}/api/payout-requests?status=all`, { headers }),
        fetch(`${API}/api/transactions`, { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (payoutsRes.ok) setWithdrawals(await payoutsRes.json());
      if (txRes.ok) {
        const tx = await txRes.json();
        setTransactions(tx.slice(-100).reverse());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (SHOP_TABS.includes(hash)) setActiveTabState(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!loading && sessionStorage.getItem('enterPayShowWelcome') === '1') {
      sessionStorage.removeItem('enterPayShowWelcome');
      setShowWelcome(true);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="ep-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <ShopTopNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={onLogout}
          user={user}
          balance={0}
          theme={theme}
          onThemeToggle={onThemeToggle}
        />
        <div className="ep-page" style={{ padding: '2rem', color: 'var(--text-muted)' }}>Загрузка кабинета…</div>
      </div>
    );
  }

  return (
    <div className="ep-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ShopTopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
        user={user}
        balance={stats?.balance}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />

      <div className="ep-app-main" style={{ flex: 1 }}>
        <div className="ep-page">
          {activeTab === 'overview' && (
            <ShopDashboard stats={stats} user={user} withdrawals={withdrawals} onTabChange={setActiveTab} />
          )}
          {activeTab === 'withdrawals' && (
            <ShopWithdrawals getAuthHeaders={getAuthHeaders} withdrawals={withdrawals} onCreated={refresh} />
          )}
          {activeTab === 'deposits' && <ShopDeposits transactions={transactions} />}
          {activeTab === 'analytics' && <ShopAnalytics stats={stats} withdrawals={withdrawals} />}
          {activeTab === 'api' && <ShopApi token={token} stats={stats} />}
          {activeTab === 'settings' && (
            <Settings
              user={user}
              token={token}
              getAuthHeaders={getAuthHeaders}
              onUserUpdate={onUserUpdate}
            />
          )}
        </div>
      </div>

      {showWelcome && (
        <WelcomeModal userName={user?.name} onClose={() => setShowWelcome(false)} />
      )}
    </div>
  );
}
