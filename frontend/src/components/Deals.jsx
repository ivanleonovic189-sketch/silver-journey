import { useState, useEffect } from 'react';
import { DealsIcon } from './Icons';

const PERIOD_LABELS = { day: 'День', week: 'Неделя', month: 'Месяц', all: 'Все время' };

function filterByPeriod(dateStr, period) {
  const date = new Date(dateStr);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (period === 'day') {
    return date >= todayStart && date <= todayEnd;
  }
  if (period === 'week') {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    return date >= weekStart && date <= todayEnd;
  }
  if (period === 'month') {
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);
    return date >= monthStart && date <= todayEnd;
  }
  return true;
}

export default function Deals({
  transactions,
  paymentMethods,
  merchants,
  onUpdateTransaction,
}) {
  const [period, setPeriod] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, completed, failed
  const [showPeriodSelect, setShowPeriodSelect] = useState(false);
  const [showStatusSelect, setShowStatusSelect] = useState(false);

  const isDeal = (tx) => tx.type === 'deposit' && (tx.direction === 'in' || !tx.direction);
  const deals = (transactions || []).filter(isDeal);

  const filteredDeals = deals.filter((tx) => {
    const inPeriod = filterByPeriod(tx.createdAt, period);
    const inStatus = statusFilter === 'all' || tx.status === statusFilter;
    return inPeriod && inStatus;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const getPaymentMethodName = (id) => {
    const m = paymentMethods?.find((m) => m.id === id);
    return m?.name || id;
  };

  const getMerchantName = (id) => {
    const m = merchants?.find((m) => m.id === parseInt(id, 10));
    return m?.name || `Мерчант #${id}`;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showPeriodSelect && !e.target.closest('[data-deals-period-select]')) setShowPeriodSelect(false);
      if (showStatusSelect && !e.target.closest('[data-deals-status-select]')) setShowStatusSelect(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPeriodSelect, showStatusSelect]);

  return (
    <div>
      {/* Заголовок */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>
          Сделки
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Входящие платежи к мерчанту
        </p>
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }} data-deals-period-select>
          <button
            onClick={() => setShowPeriodSelect(!showPeriodSelect)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 500,
            }}
          >
            {PERIOD_LABELS[period]}
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: showPeriodSelect ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <path d="M6 9L1 4H11L6 9Z" fill="currentColor" />
            </svg>
          </button>
          {showPeriodSelect && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.35rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', minWidth: '130px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
              {['day', 'week', 'month', 'all'].map((p) => (
                <button key={p} onClick={() => { setPeriod(p); setShowPeriodSelect(false); }} style={{ width: '100%', padding: '0.5rem 0.75rem', background: period === p ? 'var(--bg-card-hover)' : 'transparent', border: 'none', color: period === p ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', fontWeight: period === p ? 600 : 400 }}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} data-deals-status-select>
          <button
            onClick={() => setShowStatusSelect(!showStatusSelect)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 500,
            }}
          >
            {statusFilter === 'all' ? 'Все статусы' : statusFilter === 'pending' ? 'В обработке' : statusFilter === 'completed' ? 'Завершены' : 'Апелляция'}
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: showStatusSelect ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <path d="M6 9L1 4H11L6 9Z" fill="currentColor" />
            </svg>
          </button>
          {showStatusSelect && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.35rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', minWidth: '150px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
              {[
                { v: 'all', l: 'Все статусы' },
                { v: 'pending', l: 'В обработке' },
                { v: 'completed', l: 'Завершены' },
                { v: 'failed', l: 'Апелляция' },
              ].map(({ v, l }) => (
                <button key={v} onClick={() => { setStatusFilter(v); setShowStatusSelect(false); }} style={{ width: '100%', padding: '0.5rem 0.75rem', background: statusFilter === v ? 'var(--bg-card-hover)' : 'transparent', border: 'none', color: statusFilter === v ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', fontWeight: statusFilter === v ? 600 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Список сделок */}
      <section style={{
        background: 'var(--bg-card)',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}>
        {filteredDeals.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 2rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '1rem', opacity: 0.5 }}>
              <DealsIcon size={48} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              Сделок пока нет
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              Входящие платежи появятся здесь, когда покупатели будут оплачивать ордера
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredDeals.map((tx) => (
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
                      {tx.userId ? `#${tx.userId}` : '—'}
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
