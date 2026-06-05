import { useState, useEffect } from 'react';
import { API } from '../../api';
import EnterPayLogo from '../EnterPayLogo';

const PAYMENT_OPTIONS = [
  { id: 'sbp', label: 'СБП' },
  { id: 'card_ru', label: 'Карта РФ' },
];

const inputStyle = {
  width: '100%',
  padding: '0.85rem 1rem',
  background: 'var(--bg-card-hover)',
  border: '1px solid var(--border-light)',
  borderRadius: '10px',
  color: 'var(--text)',
  fontSize: '0.95rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  marginBottom: '0.4rem',
  fontWeight: 600,
};

function normalizeSiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, '')}`;
}

export default function ShopSetup({ user, getAuthHeaders, onComplete, onUserUpdate }) {
  const [shopName, setShopName] = useState(user?.name || '');
  const [siteUrl, setSiteUrl] = useState('');
  const [telegram, setTelegram] = useState(user?.telegram || '');
  const [methods, setMethods] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const toggleMethod = (id) => {
    setMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const canSubmit =
    shopName.trim().length > 0 &&
    siteUrl.trim().length > 0 &&
    telegram.trim().length > 0 &&
    methods.length > 0 &&
    !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const name = shopName.trim();
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { name, telegram: telegram.trim() },
          settings: {
            shopName: name,
            casinoSiteUrl: normalizeSiteUrl(siteUrl),
            paymentMethodsNeeded: methods,
            shopSetupComplete: true,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (data.settings?.shopSetupComplete !== true) return;
      onUserUpdate?.(data.profile);
      onComplete?.(data.settings);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '2rem 1rem',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', marginBottom: '1.25rem' }}>
            <EnterPayLogo size="lg" />
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Настройка магазина
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            padding: '1.75rem',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Название вашего магазина</label>
            <input
              style={inputStyle}
              autoComplete="off"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              maxLength={80}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Сайт магазина</label>
            <input
              style={inputStyle}
              type="text"
              inputMode="url"
              autoComplete="off"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Telegram для связи</label>
            <input
              style={inputStyle}
              autoComplete="off"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Какие методы вам нужны?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
              {PAYMENT_OPTIONS.map((opt) => {
                const active = methods.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleMethod(opt.id)}
                    style={{
                      padding: '0.85rem 1rem',
                      background: active ? 'var(--accent)' : 'var(--bg-card-hover)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      width: '100%',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      color: active ? '#fff' : 'var(--text)',
                      transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '0.95rem 1.25rem',
              background: canSubmit ? 'var(--accent)' : 'var(--bg-card-hover)',
              border: `1px solid ${canSubmit ? 'var(--accent)' : 'var(--border-light)'}`,
              borderRadius: '12px',
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: canSubmit ? (saving ? 'wait' : 'pointer') : 'not-allowed',
              opacity: saving ? 0.7 : 1,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            {saving ? 'Сохраняем…' : 'Сохранить и продолжить'}
          </button>
        </form>
      </div>
    </div>
  );
}
