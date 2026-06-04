import React, { useState, useEffect } from 'react';
import { API } from '../api';

export default function RefModal({ getAuthHeaders, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRef = async () => {
      if (!getAuthHeaders) return;
      try {
        const res = await fetch(`${API}/api/referral`, { headers: getAuthHeaders() });
        if (res.ok) {
          const d = await res.json();
          setData(d);
          setCodeInput(d?.referralCode || '');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRef();
  }, [getAuthHeaders]);

  const copyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveCode = async () => {
    const raw = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!raw || raw.length < 3 || raw.length > 20) {
      setError('Код должен быть от 3 до 20 символов (лат. буквы и цифры)');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/referral/set-code`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: raw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка');
      setData(prev => ({ ...prev, referralCode: raw, referralLink: `${window.location.origin}${window.location.pathname || '/'}#ref=${raw}` }));
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
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
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Реферальная программа
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '8px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : (
          <React.Fragment>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Приглашайте мерчантов и получайте 0.5% от их пополнений и выплат.
            </p>

            {!data?.referralCode && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                Ваш реферальный код
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder=""
                  maxLength={20}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                  }}
                />
                <button
                  onClick={saveCode}
                  disabled={saving || codeInput.trim().length < 3}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: (saving || codeInput.trim().length < 3) ? 'var(--bg-card-hover)' : 'var(--accent)',
                    border: 'none',
                    borderRadius: '8px',
                    color: (saving || codeInput.trim().length < 3) ? 'var(--text-muted)' : '#fff',
                    fontWeight: 600,
                    cursor: (saving || codeInput.trim().length < 3) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
              {error && <div style={{ fontSize: '0.8rem', color: 'var(--error)', marginTop: '0.5rem' }}>{error}</div>}
            </div>
            )}

            {data?.referralCode && (
              <div style={{
                background: 'var(--bg-card-hover)',
                borderRadius: '12px',
                padding: '1rem',
                border: '1px solid var(--border-light)',
                marginBottom: '1rem',
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Реферальная ссылка</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    readOnly
                    value={data?.referralLink || ''}
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
                    onClick={copyLink}
                    style={{
                      padding: '0.6rem 1rem',
                      background: copied ? 'transparent' : 'var(--accent)',
                      border: copied ? '1px solid var(--accent)' : 'none',
                      borderRadius: '8px',
                      color: copied ? 'var(--accent)' : '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    {copied ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--bg-card-hover)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Приглашено</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{data?.referralsCount ?? 0}</div>
              </div>
              <div style={{ background: 'var(--bg-card-hover)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Заработано</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{(data?.referralEarnings ?? 0).toLocaleString()} ₽</div>
              </div>
              <div style={{ background: 'var(--bg-card-hover)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Оборот</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{(data?.referredVolume ?? 0).toLocaleString()} ₽</div>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
