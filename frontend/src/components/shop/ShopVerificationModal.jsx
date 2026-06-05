import { useEffect } from 'react';
import EnterPayLogo from '../EnterPayLogo';

const TG_SUPPORT = 'https://t.me/d33dd33d';
const GATE_ID = 'shop-verification-gate';

export default function ShopVerificationModal({ verificationCode, userName, onLogout }) {
  useEffect(() => {
    const blockKeys = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockKeys, true);
    return () => window.removeEventListener('keydown', blockKeys, true);
  }, []);

  useEffect(() => {
    let gatePresent = false;
    const markPresent = () => {
      gatePresent = Boolean(document.getElementById(GATE_ID));
    };
    markPresent();
    const ensureGate = () => {
      if (gatePresent && !document.getElementById(GATE_ID)) {
        window.location.reload();
      }
    };
    const observer = new MutationObserver(ensureGate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id={GATE_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-verify-title"
      data-ep-verification-gate="1"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'inline-flex', marginBottom: '1.25rem' }}>
          <EnterPayLogo size="lg" />
        </div>

        <h2
          id="shop-verify-title"
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text)',
            margin: '0 0 0.5rem',
          }}
        >
          {userName ? `${userName}, подтвердите аккаунт` : 'Подтвердите аккаунт'}
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.55 }}>
          Для продолжения работы с Enter Pay нужна проверка вашего магазина. Напишите в Telegram и укажите код ниже.
        </p>

        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'var(--bg-card-hover)',
            borderRadius: '12px',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            Ваш код подтверждения
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'var(--accent)',
              fontFamily: 'monospace',
            }}
          >
            {verificationCode || '------'}
          </div>
        </div>

        <a
          href={TG_SUPPORT}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            padding: '0.95rem 1.25rem',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '12px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.95rem',
            marginBottom: '1rem',
          }}
        >
          Написать
        </a>

        <button
          type="button"
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '0.85rem 1.25rem',
            background: 'var(--error)',
            border: 'none',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
