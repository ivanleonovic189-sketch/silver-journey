import { useState, useRef } from 'react';
import { SettingsIcon, LogoutIcon, ThemeIcon, UserAvatarIcon } from '../Icons';
import EnterPayLogo from '../EnterPayLogo';

const SHOP_MENU = [
  { id: 'overview', label: 'Главная' },
  { id: 'withdrawals', label: 'Выводы' },
  { id: 'deposits', label: 'Пополнения' },
  { id: 'appeals', label: 'Апелляции' },
  { id: 'api', label: 'API' },
  { id: 'settings', label: 'Настройки' },
];

export default function ShopTopNav({
  activeTab,
  onTabChange,
  onLogout,
  user,
  balance,
  theme,
  onThemeToggle,
  setupMode = false,
}) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const hideDropdownTimer = useRef(null);

  const openUserDropdown = () => {
    if (hideDropdownTimer.current) {
      clearTimeout(hideDropdownTimer.current);
      hideDropdownTimer.current = null;
    }
    setShowUserDropdown(true);
  };

  const closeUserDropdown = () => {
    hideDropdownTimer.current = setTimeout(() => {
      setShowUserDropdown(false);
    }, 120);
  };

  return (
    <header className="ep-topnav">
      <div className="ep-topnav__left">
        <div className="ep-topnav__brand">
          <button
            type="button"
            className="ep-topnav__brand-link"
            onClick={() => onTabChange('overview')}
            aria-label="На главную"
          >
            <EnterPayLogo size="xs" className="ep-topnav__brand-text" />
          </button>
          <span className="ep-topnav__badge ep-no-copy">Shop</span>
        </div>

        <nav className="ep-topnav__menu">
          {!setupMode &&
            SHOP_MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              style={{
                padding: '0.5rem 1rem',
                background: activeTab === item.id ? 'var(--bg-card-hover)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: activeTab === item.id ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: activeTab === item.id ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.875rem',
                position: 'relative',
                transition: 'all 0.15s',
              }}
            >
              {item.label}
              {activeTab === item.id && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'var(--accent)',
                    borderRadius: '1px',
                  }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="ep-topnav__right">
        <button
          type="button"
          onClick={onThemeToggle}
          style={{
            padding: '0.5rem',
            background: 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
        >
          <ThemeIcon size={18} color="currentColor" />
        </button>

        {!setupMode && (
          <span style={{ color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600 }}>
            {(balance ?? 0).toLocaleString('ru-RU')} ₽
          </span>
        )}

        <div style={{ position: 'relative' }} data-shop-user-dropdown>
          <div onMouseEnter={openUserDropdown} onMouseLeave={closeUserDropdown}>
            <button
              type="button"
              onClick={() => setShowUserDropdown((v) => !v)}
              style={{
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '50%',
              }}
            >
              <UserAvatarIcon size={40} color="var(--bg-card-hover)" />
            </button>
          </div>

          {showUserDropdown && (
            <div
              onMouseEnter={openUserDropdown}
              onMouseLeave={closeUserDropdown}
              style={{
                position: 'absolute',
                top: 'calc(100% - 4px)',
                right: 0,
                paddingTop: '4px',
                zIndex: 1000,
              }}
            >
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: '12px',
                minWidth: '200px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                  {user?.name || 'Магазин'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Магазин ID {user?.id}
                </div>
              </div>
              {!setupMode && (
              <button
                type="button"
                onClick={() => {
                  setShowUserDropdown(false);
                  onTabChange('settings');
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                }}
              >
                <SettingsIcon size={18} color="currentColor" />
                Настройки
              </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowUserDropdown(false);
                  onLogout();
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--error)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textAlign: 'left',
                }}
              >
                <LogoutIcon size={18} color="currentColor" />
                Выход
              </button>
            </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
