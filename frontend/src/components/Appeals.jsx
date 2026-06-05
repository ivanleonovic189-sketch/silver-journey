export default function Appeals({
  transactions,
  paymentMethods,
  merchants,
  onUpdateTransaction,
}) {
  const appeals = (transactions || [])
    .filter((tx) => tx.status === 'failed')
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
          Апелляции
        </h1>
      </div>

      <section style={{
        background: 'var(--bg-card)',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}>
        {appeals.length === 0 ? (
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
              Апелляций пока нет
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {appeals.map((tx) => (
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
                  <div style={{ minWidth: '100px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Тип</div>
                    <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: '0.95rem' }}>
                      {tx.type === 'deposit' ? 'Депозит' : tx.type === 'withdraw' ? 'Вывод' : tx.type === 'merchant_deposit' ? 'Депозит мерчанта' : tx.type || 'нет'}
                    </div>
                  </div>
                  <div style={{ minWidth: '120px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Сумма</div>
                    <div style={{ fontWeight: 700, color: 'var(--error)', fontSize: '1.1rem' }}>
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
                  {tx.error && (
                    <div style={{ minWidth: '160px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Причина</div>
                      <div style={{ fontWeight: 500, color: 'var(--error)', fontSize: '0.85rem' }}>
                        {tx.error}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: 'rgba(239, 83, 80, 0.15)',
                      color: 'var(--error)',
                    }}
                  >
                    Апелляция
                  </div>
                  {onUpdateTransaction && (
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
                        title="Одобрить"
                      >
                        ✓ Одобрить
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
