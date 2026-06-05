const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: '12px',
  padding: '1.25rem',
  border: '1px solid var(--border-light)',
};

const STATUS_LABEL = {
  pending: 'Ожидает трейдера',
  in_progress: 'В обработке',
  completed: 'Выплачено',
  cancelled: 'Отменено',
};

export default function ShopDashboard({ stats, user, withdrawals, onTabChange }) {
  const recent = (withdrawals || []).slice(0, 5);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
        {user?.name ? `${user.name}` : 'Казино'}
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Кабинет казино: выводы игроков, пополнения и интеграция с Enter Pay.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {[
          { label: 'Баланс', value: `${(stats?.balance ?? 0).toLocaleString('ru-RU')} ₽` },
          { label: 'Выводов сегодня', value: stats?.withdrawalsPending ?? 0, hint: 'в очереди' },
          { label: 'Выплачено', value: `${(stats?.withdrawalsVolume ?? 0).toLocaleString('ru-RU')} ₽` },
          { label: 'Пополнений', value: `${(stats?.depositsVolume ?? 0).toLocaleString('ru-RU')} ₽` },
        ].map((item) => (
          <div key={item.label} style={cardStyle}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{item.label}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>{item.value}</div>
            {item.hint && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{item.hint}</div>
            )}
          </div>
        ))}
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
          onClick={() => onTabChange('api')}
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
          Подключить API
        </button>
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
          Последние выводы
        </h3>
        {!recent.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Пока нет заявок. Создайте первый вывод или подключите API.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {recent.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.65rem 0',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    #{r.id} · {Number(r.amount).toLocaleString('ru-RU')} ₽
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {r.bank || 'нет'} · {r.externalId ? `Игрок ${r.externalId}` : 'Без ID игрока'}
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
