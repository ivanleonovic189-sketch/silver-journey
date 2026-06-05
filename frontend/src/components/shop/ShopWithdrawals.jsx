import { useState } from 'react';
import { API } from '../../api';

const PAYMENT_LABELS = { card_ru: 'Карта РФ', sbp: 'СБП' };

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

export default function ShopWithdrawals({ getAuthHeaders, withdrawals, onCreated }) {
  const [form, setForm] = useState({
    externalId: '',
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
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/payout-requests`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          externalId: form.externalId || undefined,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          bank: form.bank,
          requisites: form.requisites,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания вывода');
      setMessage(`Заявка #${data.id} создана и отправлена трейдерам`);
      setForm({ externalId: '', amount: '', paymentMethod: 'sbp', bank: '', requisites: '' });
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
        Выводы игроков
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Создайте заявку на вывод — её подхватит трейдер Enter Pay.
      </p>

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
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>ID игрока</label>
              <input style={inputStyle} value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} placeholder="player_12345" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Сумма (₽)</label>
              <input style={inputStyle} type="number" min={100} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="5000" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Способ</label>
              <select style={inputStyle} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                <option value="sbp">СБП</option>
                <option value="card_ru">Карта РФ</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Банк</label>
              <input style={inputStyle} value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="Сбербанк" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Реквизиты</label>
            <input style={inputStyle} required value={form.requisites} onChange={(e) => setForm({ ...form, requisites: e.target.value })} placeholder="Телефон СБП или номер карты" />
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
          <p style={{ padding: '1.25rem', color: 'var(--text-muted)', margin: 0 }}>Заявок пока нет</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Игрок</th>
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
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{r.externalId || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text)', fontWeight: 600 }}>
                        {Number(r.amount).toLocaleString('ru-RU')} ₽
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
