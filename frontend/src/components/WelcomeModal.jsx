import TelegramIcon from './TelegramIcon';
import EnterPayLogo from './EnterPayLogo';
import { TG_CHANNEL_URL } from '../config';

export default function WelcomeModal({ userName, onClose }) {
  const nick = (userName || '').trim();

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
          <div style={{ display: 'inline-flex', marginBottom: '1rem' }}>
            <EnterPayLogo size="lg" />
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
            {nick ? `${nick}, добро пожаловать!` : 'Добро пожаловать!'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Вы успешно зарегистрировались на Enter Pay. Подпишитесь на канал, чтобы следить за новостями платформы.
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
