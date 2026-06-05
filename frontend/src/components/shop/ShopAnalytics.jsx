const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: '12px',
  padding: '1.25rem',
  border: '1px solid var(--border-light)',
};

export default function ShopAnalytics({ stats, withdrawals }) {
  const completed = (withdrawals || []).filter((r) => r.status === 'completed').length;
  const total = withdrawals?.length || 0;
  const successRate = total ? Math.round((completed / total) * 100) : 0;

  const byStatus = (withdrawals || []).reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
        Аналитика
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Сводка по выводам и пополнениям вашего казино.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Всего выводов', value: stats?.withdrawalsTotal ?? total },
          { label: 'Успешность', value: `${successRate}%` },
          { label: 'Объём выплат', value: `${(stats?.withdrawalsVolume ?? 0).toLocaleString('ru-RU')} ₽` },
          { label: 'Объём депозитов', value: `${(stats?.depositsVolume ?? 0).toLocaleString('ru-RU')} ₽` },
          { label: 'В очереди', value: stats?.withdrawalsPending ?? 0 },
          { label: 'В обработке', value: stats?.withdrawalsInProgress ?? 0 },
        ].map((item) => (
          <div key={item.label} style={cardStyle}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>{item.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
          Выводы по статусам
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {[
            ['pending', 'Ожидает трейдера'],
            ['in_progress', 'В обработке'],
            ['completed', 'Выплачено'],
            ['cancelled', 'Отменено'],
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{label}</span>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{byStatus[key] || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
