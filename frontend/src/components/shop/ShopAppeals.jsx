import { useState, useEffect, useCallback } from 'react';
import { API } from '../../api';

const TYPE_OPTIONS = [
  { id: 'withdrawal', label: 'Проблема с выводом' },
  { id: 'deposit', label: 'Не пришел депозит' },
  { id: 'other', label: 'Другое' },
];

const STATUS_LABEL = {
  pending: { text: 'Ожидает рассмотрения', color: 'var(--text-muted)' },
  in_review: { text: 'На проверке', color: '#f59e0b' },
  resolved: { text: 'Решена', color: 'var(--positive)' },
  rejected: { text: 'Отклонена', color: 'var(--error)' },
  cancelled: { text: 'Отменена', color: 'var(--text-muted)' },
};

const TYPE_LABEL = {
  withdrawal: 'Вывод',
  deposit: 'Пополнение',
  other: 'Другое',
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

const numberInputStyle = {
  ...inputStyle,
  MozAppearance: 'textfield',
};

const selectStyle = {
  ...inputStyle,
  paddingRight: '2.5rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  marginBottom: '0.35rem',
  fontWeight: 600,
};

const emptyListStyle = {
  minHeight: '7.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
};

export default function ShopAppeals({ token, getAuthHeaders, onChanged }) {
  const [appeals, setAppeals] = useState([]);
  const [form, setForm] = useState({
    type: 'withdrawal',
    id: '',
    amount: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/shop-appeals?status=all`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-auth-token': token,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) setAppeals(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const canSubmit = form.description.trim().length >= 1 && !submitting;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/shop-appeals`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: form.type,
          id: form.id || undefined,
          amount: form.amount ? Number(form.amount) : undefined,
          description: form.description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setForm({
        type: 'withdrawal',
        id: '',
        amount: '',
        description: '',
      });
      await load();
      onChanged?.();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAppeal = async (id) => {
    try {
      const res = await fetch(`${API}/api/shop-appeals/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) return;
      await load();
      onChanged?.();
    } catch {
      // silent
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
        Апелляции
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
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
          Новая апелляция
        </h3>
        <form onSubmit={submit} noValidate autoComplete="off">
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <label style={labelStyle}>Тип проблемы</label>
              <select
                className="ep-select"
                style={selectStyle}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>id</label>
              <input
                style={inputStyle}
                autoComplete="off"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Сумма спора</label>
              <input
                className="ep-input-no-spin"
                style={numberInputStyle}
                type="number"
                min="0"
                autoComplete="off"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <label style={labelStyle}>Описание проблемы</label>
            <textarea
              style={{ ...inputStyle, minHeight: '100px', resize: 'none' }}
              autoComplete="off"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={2000}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1.5rem',
              background: canSubmit ? 'var(--accent)' : 'var(--bg-card-hover)',
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${canSubmit ? 'var(--accent)' : 'var(--border-light)'}`,
              borderRadius: '10px',
              fontWeight: 600,
              cursor: canSubmit ? (submitting ? 'wait' : 'pointer') : 'not-allowed',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Отправляем…' : 'Создать апелляцию'}
          </button>
        </form>
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid var(--border-light)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
          Ваши апелляции
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {appeals.length === 0 ? (
            <div style={emptyListStyle}>Апелляций нету</div>
          ) : (
            appeals.map((a) => {
              const st = STATUS_LABEL[a.status] || { text: a.status, color: 'var(--text-muted)' };
              return (
                <div
                  key={a.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    background: 'var(--bg-card-hover)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>#{a.id}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        {TYPE_LABEL[a.type] || a.type}
                        {a.payoutRequestId ? ` вывод #${a.payoutRequestId}` : ''}
                        {a.amount != null ? ` ${Number(a.amount).toLocaleString('ru-RU')} ₽` : ''}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: st.color }}>{st.text}</span>
                  </div>
                  <p style={{ margin: '0 0 0.5rem', color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {a.description}
                  </p>
                  {a.resolution && (
                    <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <strong>Ответ:</strong> {a.resolution}
                    </p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(a.createdAt).toLocaleString('ru-RU')}
                      {a.externalId ? ` id ${a.externalId}` : ''}
                    </span>
                    {a.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => cancelAppeal(a.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: 'transparent',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                          color: 'var(--text-muted)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
