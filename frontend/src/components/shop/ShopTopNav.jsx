import { useState, useEffect } from 'react';
import { SettingsIcon, LogoutIcon, ThemeIcon, UserAvatarIcon } from '../Icons';
import EnterPayLogo from '../EnterPayLogo';

const SHOP_MENU = [
  { id: 'overview', label: 'Главная' },
  { id: 'withdrawals', label: 'Выводы' },
  { id: 'deposits', label: 'Пополнения' },
  { id: 'analytics', label: 'Аналитика' },
  { id: 'api', label: 'API' },
];

export default function ShopTopNav({
  activeTab,
  onTabChange,
  onLogout,
  user,
  balance,
  theme,
  onThemeToggle,
}) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('[data-shop-user-dropdown]')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

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
          <span className="ep-topnav__badge ep-no-copy">Casino</span>
        </div>

        <nav className="ep-topnav__menu">
          {SHOP_MENU.map((item) => (
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
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          <ThemeIcon size={18} color="currentColor" />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
          }}
        >
          <span style={{ color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600 }}>
            {(balance ?? 0).toLocaleString('ru-RU')} ₽
          </span>
        </div>

        <div style={{ position: 'relative' }} data-shop-user-dropdown>
          <button
            type="button"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
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

          {showUserDropdown && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                onClick={() => setShowUserDropdown(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  minWidth: '200px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  zIndex: 1000,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                    {user?.name || 'Казино'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Казино · ID {user?.id}
                  </div>
                </div>
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
