import { useState } from 'react';
import { API } from '../api';
import { TG_BOT_URL, TG_CHANNEL_URL } from '../config';

const ROLE_OPTIONS = [
  { value: 'merchant', label: 'Мерчант' },
  { value: 'shop', label: 'Магазин' },
];

export default function WelcomeModal({ userName, userRole, getAuthHeaders, onSaved, onClose }) {
  const nick = (userName || '').trim();
  const [role, setRole] = useState(userRole === 'shop' ? 'shop' : 'merchant');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!getAuthHeaders) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ profile: { role } }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved?.(data.profile);
      } else {
        setError(data.error || 'Не удалось сохранить роль');
      }
    } catch {
      setError('Ошибка подключения к серверу');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          padding: '2rem',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 0.5rem',
              letterSpacing: '-0.02em',
            }}
          >
            {nick ? `${nick}, добро пожаловать!` : 'Добро пожаловать!'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Вы успешно зарегистрировались на{' '}
            <strong style={{ color: 'var(--text)' }}>Enter Pay</strong>. Выберите роль, подпишитесь на канал и бота.
          </p>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
              fontWeight: 500,
            }}
          >
            Ваша роль
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value)}
                style={{
                  flex: 1,
                  padding: '0.875rem 1rem',
                  background: role === option.value ? 'var(--bg-card)' : 'var(--bg-card-hover)',
                  border: role === option.value ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                  borderRadius: '8px',
                  color: role === option.value ? 'var(--text)' : 'var(--text-muted)',
                  fontWeight: role === option.value ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.15s',
                  boxShadow: role === option.value ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <a
            href={TG_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '1rem 1.1rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              color: 'var(--text)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              textAlign: 'center',
            }}
          >
            Telegram-канал
          </a>
          <a
            href={TG_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '1rem 1.1rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              color: 'var(--text)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              textAlign: 'center',
            }}
          >
            Telegram-бот
          </a>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: 'var(--error)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '0.95rem',
            background: saving ? 'var(--bg-card-hover)' : 'var(--accent)',
            color: saving ? 'var(--text-muted)' : '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Сохранение...' : 'Сохранить и перейти на главную'}
        </button>
      </div>
    </div>
  );
}
