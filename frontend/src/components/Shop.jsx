import { useState, useEffect, useCallback, useRef } from 'react';
import { API } from '../api';
import EnterShopLogo from './EnterShopLogo';

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'manuals', label: 'Мануалы' },
  { id: 'bank_lk', label: 'ЛК банков' },
  { id: 'packs', label: 'Пакеты' },
];

const CATEGORY_LABELS = {
  manuals: 'Мануал',
  bank_lk: 'ЛК банка',
  packs: 'Пакет',
};

const fieldStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  fontSize: '0.85rem',
  padding: '0.35rem 0',
  borderBottom: '1px solid var(--border-light)',
};

function OrderDelivery({ delivery }) {
  const [copied, setCopied] = useState('');

  if (!delivery) return null;

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const boxStyle = {
    marginTop: '0.75rem',
    padding: '1rem',
    background: 'var(--bg-card-hover)',
    borderRadius: '10px',
    border: '1px solid var(--border-light)',
    fontSize: '0.85rem',
  };

  if (delivery.type === 'download') {
    return (
      <div style={boxStyle}>
        <a
          href={delivery.fileUrl}
          download
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          {delivery.fileLabel || 'Скачать'}
        </a>
      </div>
    );
  }

  if (delivery.type === 'bank_lk') {
    return (
      <div style={boxStyle}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>{delivery.bank}</div>
        <div style={fieldStyle}>
          <span style={{ color: 'var(--text-muted)' }}>ID доступа</span>
          <button type="button" onClick={() => copy(delivery.accessId, 'id')} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
            {delivery.accessId} {copied === 'id' ? '✓' : ''}
          </button>
        </div>
        <div style={fieldStyle}>
          <span style={{ color: 'var(--text-muted)' }}>Логин</span>
          <button type="button" onClick={() => copy(delivery.login, 'login')} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
            {delivery.login} {copied === 'login' ? '✓' : ''}
          </button>
        </div>
        <div style={fieldStyle}>
          <span style={{ color: 'var(--text-muted)' }}>Пароль</span>
          <button type="button" onClick={() => copy(delivery.password, 'pass')} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
            {delivery.password} {copied === 'pass' ? '✓' : ''}
          </button>
        </div>
        {delivery.note && <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{delivery.note}</p>}
      </div>
    );
  }

  if (delivery.type === 'pack') {
    return (
      <div style={boxStyle}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>Код пакета: {delivery.accessCode}</div>
        {(delivery.items || []).map((item, i) => (
          <div key={i} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: i < delivery.items.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>{item.bank}</div>
            <div style={{ color: 'var(--text-muted)' }}>Логин: <span style={{ color: 'var(--text)' }}>{item.login}</span></div>
            <div style={{ color: 'var(--text-muted)' }}>Пароль: <span style={{ color: 'var(--text)' }}>{item.password}</span></div>
          </div>
        ))}
        {delivery.note && <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{delivery.note}</p>}
      </div>
    );
  }

  return delivery.message ? <div style={boxStyle}>{delivery.message}</div> : null;
}

export default function Shop({ getAuthHeaders, stats, onPurchaseComplete }) {
  const [info, setInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('catalog');
  const [selected, setSelected] = useState(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [successOrder, setSuccessOrder] = useState(null);

  const balance = stats?.balance ?? 0;
  const initialLoadDone = useRef(false);
  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;

  const load = useCallback(async ({ showLoader = false } = {}) => {
    const auth = getAuthHeadersRef.current;
    if (!auth) return;
    if (showLoader || !initialLoadDone.current) setLoading(true);
    setError('');
    try {
      const headers = auth();
      const catParam = category === 'all' ? '' : `?category=${category}`;
      const [infoRes, prodRes, ordRes] = await Promise.all([
        fetch(`${API}/api/shop/info`, { headers }),
        fetch(`${API}/api/shop/products${catParam}`, { headers }),
        fetch(`${API}/api/shop/orders`, { headers }),
      ]);
      if (infoRes.ok) setInfo(await infoRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      initialLoadDone.current = true;
    } catch {
      setError('Не удалось загрузить магазин');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load({ showLoader: true });
  }, [category, load]);

  const handleBuy = async () => {
    if (!selected || !getAuthHeaders) return;
    setBuying(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/shop/orders`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка покупки');
      setSuccessOrder(data.order);
      setSelected(null);
      onPurchaseComplete?.();
      await load();
    } catch (e) {
      setError(e.message || 'Ошибка покупки');
    } finally {
      setBuying(false);
    }
  };

  const btnStyle = (active) => ({
    padding: '0.5rem 1rem',
    background: active ? 'var(--bg-card-hover)' : 'transparent',
    border: '1px solid var(--border-light)',
    borderRadius: '8px',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div className="ep-page" style={{ maxWidth: '1200px' }}>
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ marginBottom: '0.75rem' }}>
            <EnterShopLogo size="lg" />
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '520px', lineHeight: 1.5 }}>
            {info?.tagline || 'Мануалы и личные кабинеты банков для P2P. Оплата и выдача — на сайте.'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Баланс для покупок</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>{balance.toLocaleString()} ₽</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setTab('catalog')} style={btnStyle(tab === 'catalog')}>
          Каталог
        </button>
        <button type="button" onClick={() => setTab('orders')} style={btnStyle(tab === 'orders')}>
          Мои заказы {orders.length > 0 && `(${orders.length})`}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.875rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {tab === 'catalog' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)} style={btnStyle(category === c.id)}>
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Загрузка…</div>
          ) : products.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
              В этой категории пока нет товаров
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {products.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-light)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {p.image && (
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '14px',
                        background: 'var(--bg-card-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.5rem',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {CATEGORY_LABELS[p.category] || p.category}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>{p.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>{p.description}</p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Мгновенная выдача на сайте</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>
                      {p.price.toLocaleString()} {p.currency || '₽'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setError(''); setSelected(p); }}
                      style={{ padding: '0.55rem 1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      Купить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Загрузка…</div>
          ) : orders.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
              Заказов пока нет
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: o.delivery ? 0 : undefined }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Заказ #{o.id} · {new Date(o.createdAt).toLocaleString('ru')}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{o.productTitle}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
                      {o.amount.toLocaleString()} {o.currency || '₽'}
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'var(--positive-soft)', color: 'var(--positive)' }}>
                      Выдано
                    </span>
                  </div>
                </div>
                <OrderDelivery delivery={o.delivery} />
              </div>
            ))
          )}
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => !buying && setSelected(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '1.75rem', maxWidth: '440px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>Оплата на сайте</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selected.title}</p>
            <div style={{ background: 'var(--bg-card-hover)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Сумма</span>
                <strong style={{ color: 'var(--text)' }}>{selected.price.toLocaleString()} {selected.currency || '₽'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Баланс после</span>
                <strong style={{ color: balance >= selected.price ? 'var(--positive)' : 'var(--error)' }}>
                  {(balance - selected.price).toLocaleString()} ₽
                </strong>
              </div>
              <div>Товар будет выдан сразу в разделе «Мои заказы»</div>
            </div>
            {balance < selected.price && (
              <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem' }}>Недостаточно средств. Пополните баланс в кошельке.</div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" disabled={buying || balance < selected.price} onClick={handleBuy} style={{ flex: 1, padding: '0.875rem', background: buying || balance < selected.price ? 'var(--bg-card-hover)' : 'var(--accent)', color: buying || balance < selected.price ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: buying || balance < selected.price ? 'not-allowed' : 'pointer' }}>
                {buying ? 'Оплата…' : 'Оплатить с баланса'}
              </button>
              <button type="button" onClick={() => setSelected(null)} disabled={buying} style={{ flex: 1, padding: '0.875rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {successOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => setSuccessOrder(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', padding: '2rem', maxWidth: '480px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>Оплата прошла успешно</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Заказ #{successOrder.id} — товар уже доступен ниже</p>
            <OrderDelivery delivery={successOrder.delivery} />
            <button type="button" onClick={() => { setSuccessOrder(null); setTab('orders'); }} style={{ width: '100%', marginTop: '1.25rem', padding: '0.875rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
              Перейти к заказам
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
