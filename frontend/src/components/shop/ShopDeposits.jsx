const STATUS = {
  pending: 'Ожидание',
  completed: 'Зачислено',
  failed: 'Ошибка',
};

const cellStyle = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
};

const emptyBodyStyle = {
  minHeight: '22.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
  width: '100%',
};

export default function ShopDeposits({ transactions }) {
  const deposits = (transactions || []).filter(
    (t) => t.type === 'deposit' || t.type === 'merchant_deposit' || t.direction === 'in'
  );

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
        Пополнения
      </h2>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ ...cellStyle, width: '14%' }}>ID</th>
                <th style={{ ...cellStyle, width: '18%' }}>Сумма</th>
                <th style={{ ...cellStyle, width: '18%' }}>Метод</th>
                <th style={{ ...cellStyle, width: '18%' }}>Статус</th>
                <th style={{ ...cellStyle, width: '32%' }}>Дата</th>
              </tr>
            </thead>
            <tbody>
              {!deposits.length ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0, border: 'none' }}>
                    <div style={emptyBodyStyle}>Пополнений нету</div>
                  </td>
                </tr>
              ) : (
                deposits.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ ...cellStyle, color: 'var(--text)' }}>#{t.id}</td>
                    <td style={{ ...cellStyle, fontWeight: 600, color: 'var(--text)' }}>
                      {Number(t.amount).toLocaleString('ru-RU')} {t.currency || '₽'}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{t.paymentMethod || 'нет'}</td>
                    <td style={{ ...cellStyle, color: t.status === 'completed' ? 'var(--positive)' : 'var(--text-muted)' }}>
                      {STATUS[t.status] || t.status}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>
                      {new Date(t.createdAt).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
