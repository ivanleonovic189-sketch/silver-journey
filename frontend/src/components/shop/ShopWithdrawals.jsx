import { useState } from 'react';
import { API } from '../../api';

const PAYMENT_LABELS = { card_ru: 'Карта РФ', sbp: 'СБП' };
const PAYMENT_OPTIONS = [
  { id: 'sbp', label: 'СБП' },
  { id: 'card_ru', label: 'Карта РФ' },
];

const STATUS_LABEL = {
  pending: { text: 'Ожидает', color: 'var(--text-muted)' },
  in_progress: { text: 'В работе', color: '#f59e0b' },
  completed: { text: 'Выплачено', color: 'var(--positive)' },
  cancelled: { text: 'Отменено', color: 'var(--error)' },
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  background: 'var(--bg-card-hover)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '0.95rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  marginBottom: '0.35rem',
};

const emptyListStyle = {
  minHeight: '3.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
};

export default function ShopWithdrawals({ getAuthHeaders, withdrawals, onCreated }) {
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'sbp',
    bank: '',
    requisites: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const amount = Number(form.amount);
    if (!form.amount || Number.isNaN(amount) || amount < 100) {
      setError('Укажите сумму от 100');
      return;
    }
    if (!form.requisites.trim()) {
      setError('Укажите реквизиты');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/payout-requests`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          bank: form.bank,
          requisites: form.requisites,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания вывода');
      setMessage(`Заявка #${data.id} создана и отправлена трейдерам`);
      setForm({ amount: '', paymentMethod: 'sbp', bank: '', requisites: '' });
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
        Выводы игроков
      </h2>

      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid var(--border-light)',
          marginBottom: '1.5rem',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text)' }}>
          Новая заявка
        </h3>
        {message && (
          <div style={{ padding: '0.75rem', background: 'var(--positive-soft)', borderRadius: '8px', color: 'var(--positive)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(220,38,38,0.1)', borderRadius: '8px', color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}
        <form onSubmit={submit} noValidate autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Сумма</label>
            <input
              className="ep-input-no-spin"
              style={inputStyle}
              type="number"
              min={100}
              autoComplete="off"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Способ</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {PAYMENT_OPTIONS.map((opt) => {
                  const active = form.paymentMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm({ ...form, paymentMethod: opt.id })}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: active ? 'var(--accent)' : 'var(--bg-card-hover)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                        borderRadius: '8px',
                        color: active ? '#fff' : 'var(--text)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Банк</label>
              <input
                style={inputStyle}
                autoComplete="off"
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Реквизиты</label>
            <input
              style={inputStyle}
              autoComplete="off"
              value={form.requisites}
              onChange={(e) => setForm({ ...form, requisites: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              alignSelf: 'flex-start',
              padding: '0.75rem 1.75rem',
              background: submitting ? 'var(--bg-card-hover)' : 'var(--accent)',
              color: submitting ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Отправка…' : 'Создать вывод'}
          </button>
        </form>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: 'var(--text)' }}>
          Все заявки ({withdrawals?.length || 0})
        </div>
        {!withdrawals?.length ? (
          <div style={emptyListStyle}>Заявок пока нет</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Сумма</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Способ</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Статус</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Дата</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((r) => {
                  const st = STATUS_LABEL[r.status] || { text: r.status, color: 'var(--text-muted)' };
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>#{r.id}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text)', fontWeight: 600 }}>
                        {Number(r.amount).toLocaleString('ru-RU')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        {PAYMENT_LABELS[r.paymentMethod] || r.paymentMethod}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: st.color }}>{st.text}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        {new Date(r.createdAt).toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
