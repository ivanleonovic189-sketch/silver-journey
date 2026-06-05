const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: '14px',
  padding: '1.4rem 1.5rem',
  border: '1px solid var(--border-light)',
};

const DEPOSIT_STATUS = {
  pending: 'Ожидание',
  completed: 'Зачислено',
  failed: 'Ошибка',
};

function getDeposits(transactions) {
  return (transactions || []).filter(
    (t) => t.type === 'deposit' || t.type === 'merchant_deposit' || t.direction === 'in'
  );
}

const APPEAL_STATUS = {
  pending: 'Ожидает',
  in_review: 'На проверке',
  resolved: 'Решена',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
};

const APPEAL_TYPE = {
  withdrawal: 'Вывод',
  deposit: 'Пополнение',
  other: 'Другое',
};

const panelListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
  minHeight: '3.75rem',
  flex: 1,
};

const panelStyle = {
  ...cardStyle,
  borderRadius: '16px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: '7.5rem',
};

const panelRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.65rem 0',
  borderBottom: '1px solid var(--border-light)',
};

function formatSiteLabel(url) {
  if (!url) return '';
  try {
    const parsed = url.startsWith('http') ? new URL(url) : new URL(`https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return String(url).replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}

export default function ShopDashboard({ stats, user, transactions = [], appeals = [], onTabChange }) {
  const recentDeposits = getDeposits(transactions).slice(0, 5);
  const recentAppeals = (appeals || []).slice(0, 5);
  const siteLabel = formatSiteLabel(stats?.siteUrl);
  const appealsPending = stats?.appealsPending ?? 0;

  const statCardStyle = {
    ...cardStyle,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  };

  const onCardEnter = (e) => {
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.background = 'var(--bg-card-hover)';
  };
  const onCardLeave = (e) => {
    e.currentTarget.style.borderColor = 'var(--border-light)';
    e.currentTarget.style.background = 'var(--bg-card)';
  };

  return (
    <div className="ep-page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
            lineHeight: 1.3,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '0.5rem',
          }}
        >
          <span>{user?.name || 'Магазин'}</span>
          {siteLabel && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '1.05rem' }}>{siteLabel}</span>
          )}
        </h1>
      </div>

      <div
        className="ep-shop-dash-stats"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => onTabChange('deposits')}
          onKeyDown={(e) => e.key === 'Enter' && onTabChange('deposits')}
          style={statCardStyle}
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.85rem' }}>
            Пополнения
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {(stats?.depositsVolume ?? 0).toLocaleString('ru-RU')} ₽
          </div>
          {(stats?.depositsCount ?? 0) > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {stats.depositsCount} зачислено
            </div>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onTabChange('withdrawals')}
          onKeyDown={(e) => e.key === 'Enter' && onTabChange('withdrawals')}
          style={statCardStyle}
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.85rem' }}>
            Выплачено
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {(stats?.withdrawalsVolume ?? 0).toLocaleString('ru-RU')} ₽
          </div>
          {(stats?.withdrawalsCompleted ?? 0) > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {stats.withdrawalsCompleted} завершено
            </div>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onTabChange('appeals')}
          onKeyDown={(e) => e.key === 'Enter' && onTabChange('appeals')}
          style={{
            ...statCardStyle,
            borderColor: appealsPending > 0 ? '#f59e0b55' : 'var(--border-light)',
          }}
          onMouseEnter={onCardEnter}
          onMouseLeave={(e) => {
            onCardLeave(e);
            if (appealsPending > 0) e.currentTarget.style.borderColor = '#f59e0b55';
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.85rem' }}>
            Апелляции
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: appealsPending > 0 ? '#f59e0b' : 'var(--text)' }}>
            {appealsPending}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => onTabChange('withdrawals')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Создать вывод игрока
        </button>
        <button
          type="button"
          onClick={() => onTabChange('appeals')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border-light)',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Создать апелляцию
        </button>
      </div>

      <div className="ep-shop-dash-panels">
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Последние пополнения
            </h3>
            {recentDeposits.length > 0 && (
              <button
                type="button"
                onClick={() => onTabChange('deposits')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Все
              </button>
            )}
          </div>
          <div
            style={{
              ...panelListStyle,
              ...(recentDeposits.length === 0 ? { justifyContent: 'center', alignItems: 'center' } : {}),
            }}
          >
            {recentDeposits.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Пополнений нету</span>
            ) : (
              recentDeposits.map((t) => (
                <div key={t.id} style={panelRowStyle}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>
                      #{t.id} {Number(t.amount).toLocaleString('ru-RU')} ₽
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t.paymentMethod || 'нет'}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {DEPOSIT_STATUS[t.status] || t.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Апелляции
            </h3>
            {recentAppeals.length > 0 && (
              <button
                type="button"
                onClick={() => onTabChange('appeals')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Все
              </button>
            )}
          </div>
          <div
            style={{
              ...panelListStyle,
              ...(recentAppeals.length === 0 ? { justifyContent: 'center', alignItems: 'center' } : {}),
            }}
          >
            {recentAppeals.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Апелляций нету</span>
            ) : (
              recentAppeals.map((a) => (
                <div key={a.id} style={panelRowStyle}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>
                      #{a.id} {APPEAL_TYPE[a.type] || a.type}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {a.amount != null ? `${Number(a.amount).toLocaleString('ru-RU')} ₽` : 'нет'}
                      {a.payoutRequestId ? ` вывод #${a.payoutRequestId}` : ''}
                      {a.externalId ? ` id ${a.externalId}` : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: a.status === 'pending' || a.status === 'in_review' ? '#f59e0b' : 'var(--text-muted)',
                    }}
                  >
                    {APPEAL_STATUS[a.status] || a.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
