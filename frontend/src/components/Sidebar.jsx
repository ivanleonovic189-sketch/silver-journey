import {
  HomeIcon,
  DealsIcon,
  AppealsIcon,
  PayoutsIcon,
  DevicesIcon,
  PayIcon,
  RefIcon,
  SettingsIcon,
  LogoutIcon,
} from './Icons';

export default function Sidebar({ activeTab, onTabChange, onLogout }) {
  const menuItems = [
    { id: 'dashboard', label: 'Главная', icon: HomeIcon },
    { id: 'deals', label: 'Сделки', icon: DealsIcon },
    { id: 'appeals', label: 'Апелляции', icon: AppealsIcon },
    { id: 'payouts', label: 'Выплаты', icon: PayoutsIcon },
    { id: 'devices', label: 'Устройства', icon: DevicesIcon },
    { id: 'pay', label: 'Pay', icon: PayIcon },
    { id: 'ref', label: 'Ref', icon: RefIcon },
    { id: 'settings', label: 'Настройки', icon: SettingsIcon },
  ];

  return (
    <div
      style={{
        width: '260px',
        height: '100vh',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        padding: '1.5rem 0',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Логотип */}
      <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
        <div
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--green) 0%, var(--green-bright) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.25rem',
          }}
        >
          Ship Pay
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          High-Risk система
        </div>
      </div>

      {/* Навигация */}
      <nav style={{ flex: 1, padding: '0 1rem' }}>
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                marginBottom: '0.5rem',
                background: activeTab === item.id ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                color: activeTab === item.id ? 'var(--green)' : 'var(--text-muted)',
                fontWeight: activeTab === item.id ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
                textAlign: 'left',
                borderLeft: activeTab === item.id ? '3px solid var(--green)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== item.id) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
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
              <IconComponent size={20} color={activeTab === item.id ? 'var(--green)' : 'var(--text-muted)'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Выход */}
      <div style={{ padding: '0 1rem', marginTop: 'auto' }}>
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '0.875rem 1rem',
            background: 'transparent',
            border: 'none',
            borderRadius: '10px',
            color: 'var(--red)',
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'all 0.2s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 83, 80, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogoutIcon size={20} color="var(--red)" />
          <span>Выйти</span>
        </button>
      </div>
    </div>
  );
}
