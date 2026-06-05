import { useEffect, useState } from 'react';
import { API } from '../api';
import EnterPayLogo from './EnterPayLogo';

export function parseAcceptCodeFromPath(pathname = window.location.pathname) {
  const match = String(pathname || '').match(/^\/acceptcode(EP-[A-F0-9]+)$/i);
  return match ? match[1].toUpperCase() : null;
}

export default function AcceptCode({ code }) {
  const [status, setStatus] = useState('loading');
  const [shopName, setShopName] = useState('');

  useEffect(() => {
    if (!code) {
      window.location.replace('/');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/acceptcode/${encodeURIComponent(code)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.ok) {
          setShopName(data.name || '');
          setStatus(data.already ? 'already' : 'done');
          window.history.replaceState(null, '', '/');
        } else {
          window.location.replace('/');
        }
      } catch {
        if (!cancelled) window.location.replace('/');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (status === 'loading') {
    return (
      <div className="ep-auth-page">
        <div className="ep-auth-card" style={{ textAlign: 'center' }}>
          <EnterPayLogo size="md" />
          <p style={{ margin: '1.5rem 0 0', color: 'var(--text-muted)' }}>Подтверждаем магазин…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-auth-page">
      <div className="ep-auth-card" style={{ textAlign: 'center' }}>
        <EnterPayLogo size="md" />
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)', margin: '1.5rem 0 0.5rem' }}>
          {status === 'already' ? 'Магазин уже подтверждён' : 'Магазин подтверждён'}
        </h1>
        {shopName && (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>{shopName}</p>
        )}
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '1.75rem',
            padding: '0.875rem 1.5rem',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          На главную
        </a>
      </div>
    </div>
  );
}
