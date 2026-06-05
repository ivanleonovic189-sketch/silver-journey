const STATUS = {
  pending: 'Ожидание',
  completed: 'Зачислено',
  failed: 'Ошибка',
};

export default function ShopDeposits({ transactions }) {
  const deposits = (transactions || []).filter(
    (t) => t.type === 'deposit' || t.type === 'merchant_deposit' || t.direction === 'in'
  );

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
        Пополнения
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Входящие платежи игроков на ваш мерчант-аккаунт Enter Pay.
      </p>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        {!deposits.length ? (
          <p style={{ padding: '1.5rem', color: 'var(--text-muted)', margin: 0 }}>
            Пополнений пока нет. После подключения API депозиты игроков появятся здесь.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Сумма</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Метод</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Статус</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Дата</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>#{t.id}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text)' }}>
                      {Number(t.amount).toLocaleString('ru-RU')} {t.currency || '₽'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{t.paymentMethod || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: t.status === 'completed' ? 'var(--positive)' : 'var(--text-muted)' }}>
                      {STATUS[t.status] || t.status}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                      {new Date(t.createdAt).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
