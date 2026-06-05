import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { API } from '../../api';
import Loader from '../Loader';
import ShopTopNav from './ShopTopNav';
import ShopDashboard from './ShopDashboard';
import ShopWithdrawals from './ShopWithdrawals';
import ShopDeposits from './ShopDeposits';
import ShopAnalytics from './ShopAnalytics';
import ShopApi from './ShopApi';
import Settings from '../Settings';
import ShopVerificationModal from './ShopVerificationModal';

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

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`,
    'x-auth-token': token,
    'Content-Type': 'application/json',
  });

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
      await Promise.all([
        checkVerification(),
        (async () => {
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
        })(),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, checkVerification]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      checkVerification();
      if (verified) {
        fetch(`${API}/api/stats`, { headers: getAuthHeaders() })
          .then((r) => r.ok && r.json())
          .then((d) => d && setStats(d))
          .catch(() => {});
      }
    }, 8000);
    return () => clearInterval(id);
  }, [refresh, checkVerification, verified, token]);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1);
      if (SHOP_TABS.includes(hash)) setActiveTabState(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (loading) {
    return (
      <div className="ep-shell" style={{ minHeight: '100vh' }}>
        <Loader user={user} subtitle="Загружаем кабинет казино…" />
      </div>
    );
  }

  const showVerificationGate = !verified;

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
              <ShopDashboard stats={stats} user={user} withdrawals={withdrawals} onTabChange={setActiveTab} />
            )}
            {activeTab === 'withdrawals' && (
              <ShopWithdrawals getAuthHeaders={getAuthHeaders} withdrawals={withdrawals} onCreated={refresh} />
            )}
            {activeTab === 'deposits' && <ShopDeposits transactions={transactions} />}
            {activeTab === 'analytics' && <ShopAnalytics stats={stats} withdrawals={withdrawals} />}
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
