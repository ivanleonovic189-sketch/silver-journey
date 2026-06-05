import { useState, useEffect, useCallback } from 'react';
import { API } from '../../api';

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  background: 'var(--bg-card-hover)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '0.85rem',
  fontFamily: 'monospace',
};

export default function ShopApi({ token, stats }) {
  const [integration, setIntegration] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/api/settings`, {
      headers: { Authorization: `Bearer ${token}`, 'x-auth-token': token },
    });
    if (res.ok) {
      const data = await res.json();
      setIntegration(data.integration);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const apiBase = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app';
  const example = `curl -X POST ${apiBase}/api/payout-requests \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "paymentMethod": "sbp",
    "bank": "Сбербанк",
    "requisites": "+79001234567",
    "externalId": "player_123"
  }'`;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
        API интеграция
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Подключите сайт казино к Enter Pay: создавайте выводы игроков автоматически.
      </p>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)', marginBottom: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Merchant ID</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input style={inputStyle} readOnly value={String(integration?.merchantId || stats?.merchantId || '—')} />
            <button type="button" onClick={() => copy(String(integration?.merchantId || stats?.merchantId), 'mid')} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card-hover)', cursor: 'pointer', color: 'var(--text)' }}>
              {copied === 'mid' ? 'OK' : 'Копировать'}
            </button>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>API Key</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: 1, minWidth: '200px' }} readOnly type={showKey ? 'text' : 'password'} value={integration?.apiKey || ''} />
            <button type="button" onClick={() => setShowKey(!showKey)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card-hover)', cursor: 'pointer', color: 'var(--text)' }}>
              {showKey ? 'Скрыть' : 'Показать'}
            </button>
            <button type="button" onClick={() => copy(integration?.apiKey, 'key')} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
              {copied === 'key' ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Postback URL и события настраиваются в разделе «Настройки» → постбэки.
        </p>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '1.5rem', border: '1px solid var(--border-light)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>
          Пример: создать вывод игрока
        </h3>
        <pre style={{ margin: 0, padding: '1rem', background: 'var(--bg-deep)', borderRadius: '8px', overflow: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {example}
        </pre>
      </div>
    </div>
  );
}
