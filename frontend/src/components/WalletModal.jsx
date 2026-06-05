export default function WalletModal({ stats, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-light)',
          padding: '2rem',
          width: '90%',
          maxWidth: '420px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Кошелек
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '8px',
              fontSize: '1.5rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div
            style={{
              flex: 1,
              background: 'var(--bg-card-hover)',
              borderRadius: '10px',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.75rem' }}>
              Страховой депозит
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
              {(stats?.insuranceDeposit ?? 0).toLocaleString()} ₽
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: 'var(--bg-card-hover)',
              borderRadius: '10px',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.75rem' }}>
              Рабочий депозит
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
              {(stats?.workingDeposit ?? 0).toLocaleString()} ₽
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
