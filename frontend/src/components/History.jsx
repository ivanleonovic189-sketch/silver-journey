import { useState, useEffect } from 'react';

const PAYMENT_LABELS = { card_ru: 'Банковская карта РФ', sbp: 'СБП' };
const STATUS_LABELS = {
  completed: 'Оплачено',
  in_progress: 'В процессе',
  cancelled: 'Отменено',
  pending: 'Ожидает',
};

export default function History({ payoutRequests, transactions = [], getAuthHeaders, onTabChange, user }) {
  const [filter, setFilter] = useState('all'); // all, payouts, withdrawals, deposits
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const API = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  useEffect(() => {
    const fetchAll = async () => {
      if (!getAuthHeaders) return;
      try {
        const res = await fetch(`${API}/api/payout-requests?status=all`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setAllRequests(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [getAuthHeaders, payoutRequests]);

  // Payout-заявки, с которыми мы работали
  const myPayouts = allRequests.filter((r) => {
    if (r.status === 'completed' || r.status === 'in_progress') return r.traderId === user?.id;
    if (r.status === 'cancelled') return r.cancelledBy === user?.id;
    return false;
  });

  const deposits = (transactions || []).filter(
    (t) =>
      (t.type === 'merchant_deposit' || (t.type === 'deposit' && t.direction === 'in')) &&
      t.status === 'completed'
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('ru', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed':
        return { bg: 'rgba(0, 255, 136, 0.15)', color: 'var(--green-bright)' };
      case 'in_progress':
        return { bg: 'rgba(255, 184, 77, 0.15)', color: 'var(--yellow)' };
      case 'cancelled':
        return { bg: 'rgba(239, 83, 80, 0.15)', color: 'var(--red)' };
      default:
        return { bg: 'rgba(128, 128, 128, 0.15)', color: 'var(--text-muted)' };
    }
  };

  const allItems = [
    ...myPayouts.map((r) => ({ type: 'payout', data: r, date: r.completedAt || r.acceptedAt || r.cancelledAt || r.createdAt })),
    ...deposits.map((t) => ({ type: 'deposit', data: t, date: t.updatedAt || t.createdAt })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredItems =
    filter === 'all'
      ? allItems
      : filter === 'payouts'
        ? allItems.filter((i) => i.type === 'payout')
        : allItems.filter((i) => i.type === 'deposit');

  const btnStyle = (active) => ({
    padding: '0.5rem 1rem',
    background: active ? 'var(--bg-card-hover)' : 'transparent',
    border: '1px solid var(--border-light)',
    borderRadius: '8px',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
        История
      </h2>

      {/* Кнопки фильтров */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={btnStyle(filter === 'all')}>
          Все
        </button>
        <button onClick={() => setFilter('payouts')} style={btnStyle(filter === 'payouts')}>
          Выплаты
        </button>
        <button onClick={() => setFilter('deposits')} style={btnStyle(filter === 'deposits')}>
          Пополнения
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Загрузка...</div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Нет записей</div>
          <button
            onClick={() => onTabChange?.('payouts')}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'var(--green)',
              color: '#000',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Перейти к выплатам
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredItems.map((item, idx) => {
            if (item.type === 'payout') {
              const req = item.data;
              const statusStyle = getStatusStyle(req.status);
              return (
                <div
                  key={`p-${req.id}`}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1.1rem' }}>
                        Выплата #{req.id}
                      </span>
                      <span
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: statusStyle.bg,
                          color: statusStyle.color,
                        }}
                      >
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {req.bank || '—'} • {PAYMENT_LABELS[req.paymentMethod] || req.paymentMethod}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      {formatDate(item.date)}
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green-bright)' }}>
                    {(req.amount || 0).toLocaleString()} ₽
                  </div>
                  {req.status === 'in_progress' && (
                    <button
                      onClick={() => onTabChange?.('payouts')}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'var(--green)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      Продолжить
                    </button>
                  )}
                </div>
              );
            }
            if (item.type === 'deposit') {
              const tx = item.data;
              return (
                <div
                  key={`d-${tx.id}`}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {tx.type === 'merchant_deposit' ? 'Пополнение' : 'Депозит'} #{tx.id}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {formatDate(item.date)} • {tx.paymentMethod || '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green-bright)' }}>
                    +{(tx.amount || 0).toLocaleString()} ₽
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
