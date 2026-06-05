import { useState, useEffect } from 'react';
import { API } from '../api';

export default function RefModal({ getAuthHeaders, onClose }) {
  const [referralLink, setReferralLink] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchRef = async () => {
      if (!getAuthHeaders) return;
      try {
        const res = await fetch(`${API}/api/referral`, { headers: getAuthHeaders() });
        if (res.ok) {
          const d = await res.json();
          setReferralLink(d.referralLink || '');
          setReferralCode(d.referralCode || '');
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchRef();
  }, [getAuthHeaders]);

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '480px',
          width: '100%',
          border: '1px solid var(--border-light)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Реферальная программа
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
              fontSize: '1.5rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {referralCode && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>
            Ваш код: {referralCode}
          </div>
        )}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
          Реферальная ссылка
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            readOnly
            value={referralLink}
            style={{
              flex: 1,
              padding: '0.6rem',
              background: 'transparent',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.85rem',
            }}
          />
          <button
            type="button"
            onClick={copyLink}
            disabled={!referralLink}
            style={{
              padding: '0.6rem 1rem',
              background: copied ? 'transparent' : 'var(--accent)',
              border: copied ? '1px solid var(--accent)' : 'none',
              borderRadius: '8px',
              color: copied ? 'var(--accent)' : '#fff',
              fontWeight: 600,
              cursor: referralLink ? 'pointer' : 'not-allowed',
              fontSize: '0.85rem',
              opacity: referralLink ? 1 : 0.5,
            }}
          >
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
      </div>
    </div>
  );
}
