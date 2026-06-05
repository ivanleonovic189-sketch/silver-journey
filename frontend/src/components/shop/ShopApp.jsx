import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API } from '../../api';
import Loader from '../Loader';
import ShopTopNav from './ShopTopNav';
import ShopDashboard from './ShopDashboard';
import ShopWithdrawals from './ShopWithdrawals';
import ShopDeposits from './ShopDeposits';
import ShopApi from './ShopApi';
import ShopAppeals from './ShopAppeals';
import Settings from '../Settings';
import ShopVerificationModal from './ShopVerificationModal';
import ShopSetup from './ShopSetup';

const SHOP_TABS = ['overview', 'withdrawals', 'deposits', 'appeals', 'api', 'settings'];

export default function ShopApp({ user, token, onLogout, theme, onThemeToggle, onUserUpdate }) {
  const [activeTab, setActiveTabState] = useState(() => {
    const hash = window.location.hash.slice(1);
    return SHOP_TABS.includes(hash) ? hash : 'overview';
  });
  const [stats, setStats] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopConfigured, setShopConfigured] = useState(false);
  const [verified, setVerified] = useState(() =>
    user?.role === 'shop' ? user?.verified === true : true
  );
  const [verificationCode, setVerificationCode] = useState(() =>
    user?.role === 'shop' && user?.verified !== true ? user?.verificationCode || '' : ''
  );

  useEffect(() => {
    if (user?.role !== 'shop') return;
    setVerified(user.verified === true);
    if (user.verified !== true && user.verificationCode) {
      setVerificationCode(user.verificationCode);
    }
  }, [user?.verified, user?.verificationCode, user?.role]);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    window.location.hash = SHOP_TABS.includes(tab) ? tab : 'overview';
  };

  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'x-auth-token': token,
    'Content-Type': 'application/json',
  }), [token]);

  const refreshStats = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'x-auth-token': token };
    try {
      const [statsRes, appealsRes] = await Promise.all([
        fetch(`${API}/api/stats`, { headers }),
        fetch(`${API}/api/shop-appeals?status=all`, { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (appealsRes.ok) setAppeals(await appealsRes.json());
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  const loadShopSettings = useCallback(async () => {
    if (!token) return false;
    try {
      const res = await fetch(`${API}/api/settings`, {
        headers: { Authorization: `Bearer ${token}`, 'x-auth-token': token },
      });
      if (!res.ok) return false;
      const data = await res.json();
      const configured = data.settings?.shopSetupComplete === true;
      setShopConfigured(configured);
      return configured;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [token]);

  const checkVerification = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}`, 'x-auth-token': token },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) {
        onUserUpdate?.(data.user);
      }
      const isVerified =
        data.user?.role === 'shop'
          ? data.verification?.verified === true || data.user?.verified === true
          : true;
      setVerified(isVerified);
      if (data.verification?.code) {
        setVerificationCode(data.verification.code);
      } else if (data.user?.verificationCode && !isVerified) {
        setVerificationCode(data.user.verificationCode);
      }
    } catch (e) {
      console.error(e);
    }
  }, [token, onUserUpdate]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const headers = getAuthHeaders();
    try {
      const configured = await loadShopSettings();
      await Promise.all([
        checkVerification(),
        (async () => {
          if (!configured) return;
          const [statsRes, payoutsRes, txRes, appealsRes] = await Promise.all([
            fetch(`${API}/api/stats`, { headers }),
            fetch(`${API}/api/payout-requests?status=all`, { headers }),
            fetch(`${API}/api/transactions`, { headers }),
            fetch(`${API}/api/shop-appeals?status=all`, { headers }),
          ]);
          if (statsRes.ok) setStats(await statsRes.json());
          if (payoutsRes.ok) setWithdrawals(await payoutsRes.json());
          if (txRes.ok) {
            const tx = await txRes.json();
            setTransactions(tx.slice(-100).reverse());
          }
          if (appealsRes.ok) setAppeals(await appealsRes.json());
        })(),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, checkVerification, loadShopSettings]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      checkVerification();
      if (verified && shopConfigured) {
        fetch(`${API}/api/stats`, { headers: getAuthHeaders() })
          .then((r) => r.ok && r.json())
          .then((d) => d && setStats(d))
          .catch(() => {});
      }
    }, 8000);
    return () => clearInterval(id);
  }, [refresh, checkVerification, verified, shopConfigured, token]);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'analytics') {
        window.location.hash = 'overview';
        setActiveTabState('overview');
        return;
      }
      if (SHOP_TABS.includes(hash)) setActiveTabState(hash);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const handleSetupComplete = async (settings) => {
    if (settings?.shopSetupComplete !== true) return;
    setShopConfigured(true);
    window.location.hash = 'overview';
    setActiveTabState('overview');
    if (!token) return;
    const headers = getAuthHeaders();
    try {
      const [statsRes, payoutsRes, txRes, appealsRes] = await Promise.all([
        fetch(`${API}/api/stats`, { headers }),
        fetch(`${API}/api/payout-requests?status=all`, { headers }),
        fetch(`${API}/api/transactions`, { headers }),
        fetch(`${API}/api/shop-appeals?status=all`, { headers }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (payoutsRes.ok) setWithdrawals(await payoutsRes.json());
      if (txRes.ok) {
        const tx = await txRes.json();
        setTransactions(tx.slice(-100).reverse());
      }
      if (appealsRes.ok) setAppeals(await appealsRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="ep-shell" style={{ minHeight: '100vh' }}>
        <Loader user={user} subtitle="Загружаем кабинет магазина…" />
      </div>
    );
  }

  const showVerificationGate = !verified;
  const showSetup = verified && !shopConfigured;

  if (showSetup) {
    return (
      <div className="ep-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <ShopTopNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={onLogout}
          user={user}
          theme={theme}
          onThemeToggle={onThemeToggle}
          setupMode
        />
        <ShopSetup
          user={user}
          getAuthHeaders={getAuthHeaders}
          onComplete={handleSetupComplete}
          onUserUpdate={onUserUpdate}
        />
      </div>
    );
  }

  return (
    <div
      className="ep-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        pointerEvents: showVerificationGate ? 'none' : 'auto',
        userSelect: showVerificationGate ? 'none' : 'auto',
      }}
    >
      <div style={{ pointerEvents: showVerificationGate ? 'none' : 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ShopTopNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={onLogout}
          user={user}
          balance={stats?.balance}
          theme={theme}
          onThemeToggle={onThemeToggle}
        />

        <div className="ep-app-main" style={{ flex: 1, filter: showVerificationGate ? 'blur(6px)' : 'none' }}>
          <div className="ep-page">
            {activeTab === 'overview' && (
              <ShopDashboard
                stats={stats}
                user={user}
                transactions={transactions}
                appeals={appeals}
                onTabChange={setActiveTab}
              />
            )}
            {activeTab === 'withdrawals' && (
              <ShopWithdrawals getAuthHeaders={getAuthHeaders} withdrawals={withdrawals} onCreated={refresh} />
            )}
            {activeTab === 'deposits' && <ShopDeposits transactions={transactions} />}
            {activeTab === 'appeals' && (
              <ShopAppeals
                token={token}
                getAuthHeaders={getAuthHeaders}
                onChanged={refreshStats}
              />
            )}
            {activeTab === 'api' && <ShopApi token={token} stats={stats} />}
            {activeTab === 'settings' && (
              <Settings user={user} token={token} getAuthHeaders={getAuthHeaders} onUserUpdate={onUserUpdate} />
            )}
          </div>
        </div>
      </div>

      {showVerificationGate &&
        createPortal(
          <ShopVerificationModal
            verificationCode={verificationCode}
            userName={user?.name}
            onLogout={onLogout}
          />,
          document.body
        )}
    </div>
  );
}
