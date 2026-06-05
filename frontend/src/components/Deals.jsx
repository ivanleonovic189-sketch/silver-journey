export default function Deals({
  transactions,
  paymentMethods,
  merchants,
  onUpdateTransaction,
}) {
  const isDeal = (tx) => tx.type === 'deposit' && (tx.direction === 'in' || !tx.direction);
  const deals = (transactions || [])
    .filter(isDeal)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const getPaymentMethodName = (id) => {
    const m = paymentMethods?.find((m) => m.id === id);
    return m?.name || id;
  };

  const getMerchantName = (id) => {
    const m = merchants?.find((m) => m.id === parseInt(id, 10));
    return m?.name || `Мерчант #${id}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Сделки
        </h1>
      </div>

      <section style={{
        background: 'var(--bg-card)',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}>
        {deals.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '16rem',
            padding: '8rem 2rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>
              Сделок пока нет
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {deals.map((tx) => (
              <div
                key={tx.id}
                style={{
                  padding: '1.25rem',
                  background: 'var(--bg-deep)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-deep)';
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: '80px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>ID</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>#{tx.id}</div>
                  </div>
                  <div style={{ minWidth: '120px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Сумма</div>
                    <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '1.1rem' }}>
                      {tx.amount.toLocaleString()} {tx.currency || '₽'}
                    </div>
                  </div>
                  <div style={{ minWidth: '140px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Метод</div>
                    <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '0.95rem' }}>
                      {getPaymentMethodName(tx.paymentMethod)}
                    </div>
                  </div>
                  <div style={{ minWidth: '100px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Пользователь</div>
                    <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '0.95rem' }}>
                      {tx.userId ? `#${tx.userId}` : 'нет'}
                    </div>
                  </div>
                  <div style={{ minWidth: '140px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Мерчант</div>
                    <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '0.95rem' }}>
                      {getMerchantName(tx.merchantId)}
                    </div>
                  </div>
                  <div style={{ minWidth: '140px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Дата</div>
                    <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '0.9rem' }}>
                      {new Date(tx.createdAt).toLocaleString('ru')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background:
                        tx.status === 'completed'
                          ? 'var(--positive-soft)'
                          : tx.status === 'pending'
                          ? 'rgba(255, 184, 77, 0.15)'
                          : 'rgba(239, 83, 80, 0.15)',
                      color:
                        tx.status === 'completed'
                          ? 'var(--positive)'
                          : tx.status === 'pending'
                          ? 'var(--warning)'
                          : 'var(--error)',
                    }}
                  >
                    {tx.status === 'completed' ? 'Завершена' : tx.status === 'pending' ? 'В обработке' : 'Апелляция'}
                  </div>
                  {tx.status === 'pending' && onUpdateTransaction && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => onUpdateTransaction(tx.id, 'completed')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'var(--green)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        title="Подтвердить"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => onUpdateTransaction(tx.id, 'failed')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'var(--error)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        title="Отклонить"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
