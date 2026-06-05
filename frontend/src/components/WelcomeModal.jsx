import TelegramIcon from './TelegramIcon';
import { TG_BOT_URL, TG_CHANNEL_URL } from '../config';

export default function WelcomeModal({ userName, onClose }) {
  const firstName = (userName || '').trim().split(/\s+/)[0];

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
      onClick={onClose}
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
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: '1rem',
            }}
          >
            E
          </div>
          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: '0 0 0.5rem',
              letterSpacing: '-0.02em',
            }}
          >
            {firstName ? `${firstName}, добро пожаловать!` : 'Добро пожаловать!'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Вы успешно зарегистрировались на{' '}
            <strong style={{ color: 'var(--text)' }}>Enter Pay</strong>. Подпишитесь на канал и бота, чтобы не пропустить важные уведомления.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <a
            href={TG_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.1rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              color: 'var(--text)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <TelegramIcon size={28} />
            <span>Telegram-канал</span>
          </a>
          <a
            href={TG_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.1rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              color: 'var(--text)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <TelegramIcon size={28} />
            <span>Telegram-бот</span>
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.95rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Перейти на главную
        </button>
      </div>
    </div>
  );
}
