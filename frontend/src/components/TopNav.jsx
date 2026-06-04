import { useState, useEffect } from 'react';
import {
  RefIcon,
  SettingsIcon,
  LogoutIcon,
  WalletIcon,
  ThemeIcon,
  UserAvatarIcon,
} from './Icons';

export default function TopNav({ activeTab, onTabChange, onLogout, user, balance, onWalletClick, onRefClick, theme, onThemeToggle, merchantDevices = [] }) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const menuItems = [
    { id: 'dashboard', label: 'Главная', icon: null },
    { id: 'deals', label: 'Сделки', icon: null },
    { id: 'appeals', label: 'Апелляции', icon: null },
    { id: 'payouts', label: 'Выплаты', icon: null },
    { id: 'history', label: 'История', icon: null },
    { id: 'devices', label: 'Устройства', icon: null },
  ];

  // Закрываем dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('[data-user-dropdown]')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  return (
    <header className="ep-topnav">
      <div className="ep-topnav__left">
        <div className="ep-topnav__brand-row">
        <div className="ep-topnav__brand">
          <button
            type="button"
            className="ep-topnav__brand-link"
            onClick={() => onTabChange('dashboard')}
            aria-label="На главную"
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 800,
                letterSpacing: '-0.04em',
              }}
            >
              E
            </div>
            <div className="ep-topnav__brand-text">
              Enter <span style={{ color: 'var(--accent)' }}>Pay</span>
            </div>
          </button>
          <span className="ep-topnav__badge">High-risk</span>
        </div>
        </div>

        <nav className="ep-topnav__menu">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== item.id) {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== item.id) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                {IconComponent && <IconComponent size={18} color="currentColor" />}
                <span>{item.label}</span>
                {activeTab === item.id && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      width: '100%',
                      height: '2px',
                      background: 'var(--accent)',
                      borderRadius: '1px',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="ep-topnav__right">
        {/* Переключатель темы */}
        <button
          onClick={onThemeToggle}
          style={{
            padding: '0.5rem',
            background: 'transparent',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-card-hover)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
        >
          <ThemeIcon size={18} color="currentColor" />
        </button>

        {/* Баланс */}
        <div
          onClick={onWalletClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-card-hover)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'var(--border-light)';
          }}
        >
          <span style={{ color: 'var(--text)', fontSize: '0.95rem', fontWeight: 600 }}>
            {balance?.toLocaleString() || 0} ₽
          </span>
          <WalletIcon size={18} color="var(--text-muted)" />
        </div>

        {/* Пользователь - аватарка с dropdown */}
        <div style={{ position: 'relative' }} data-user-dropdown>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            style={{
              padding: '0',
              background: 'transparent',
              border: (() => {
                const hasDevices = merchantDevices.length > 0;
                const allOffline = hasDevices && merchantDevices.every(d => d.online === false);
                const hasAnyOnline = hasDevices && merchantDevices.some(d => d.online !== false);
                return allOffline ? '2px solid var(--error)' : hasAnyOnline ? '2px solid var(--positive)' : 'none';
              })(),
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.15s',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <UserAvatarIcon size={40} color="var(--bg-card-hover)" />
          </button>
          
          {/* Dropdown меню */}
          {showUserDropdown && (
            <>
              {/* Overlay для закрытия при клике вне */}
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999,
                }}
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
                {/* Информация о пользователе */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span>{user?.name || 'Пользователь'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {user?.role === 'shop' ? 'Магазин' : user?.role === 'merchant' ? 'Мерчант' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {user?.id}</div>
                </div>
                
                {/* Настройки */}
                <button
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
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <SettingsIcon size={18} color="currentColor" />
                  <span>Настройки</span>
                </button>
                
                {/* Реферальная ссылка */}
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onRefClick?.();
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
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <RefIcon size={18} color="currentColor" />
                  <span>Реферальная ссылка</span>
                </button>
                
                {/* Разделитель */}
                <div style={{ height: '1px', background: 'var(--border-light)', margin: '0.5rem 0' }} />
                
                {/* Выход */}
                <button
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
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <LogoutIcon size={18} color="currentColor" />
                  <span>Выход</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
