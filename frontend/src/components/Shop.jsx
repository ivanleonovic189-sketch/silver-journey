import { useState, useEffect, useCallback } from 'react';
import { API } from '../api';
import { TG_BOT_URL, TG_CHANNEL_URL } from '../config';
import TelegramIcon from './TelegramIcon';

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'manuals', label: 'Мануалы' },
  { id: 'bank_lk', label: 'ЛК банков' },
  { id: 'packs', label: 'Пакеты' },
  { id: 'consulting', label: 'Консультации' },
];

const CATEGORY_LABELS = {
  manuals: 'Мануал',
  bank_lk: 'ЛК банка',
  packs: 'Пакет',
  consulting: 'Консультация',
};

const STATUS_LABELS = {
  processing: 'В обработке',
  completed: 'Выдано',
  cancelled: 'Отменён',
};

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

  const load = useCallback(async () => {
    if (!getAuthHeaders) return;
    setLoading(true);
    setError('');
    try {
      const headers = getAuthHeaders();
      const catParam = category === 'all' ? '' : `?category=${category}`;
      const [infoRes, prodRes, ordRes] = await Promise.all([
        fetch(`${API}/api/shop/info`, { headers }),
        fetch(`${API}/api/shop/products${catParam}`, { headers }),
        fetch(`${API}/api/shop/orders`, { headers }),
      ]);
      if (infoRes.ok) setInfo(await infoRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
    } catch (e) {
      setError('Не удалось загрузить магазин');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, category]);

  useEffect(() => {
    load();
  }, [load]);

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
      {/* Шапка магазина */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
              }}
            >
              Enter Pay Shop
            </span>
            {info?.vendor && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>× {info.vendor}</span>
            )}
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.4rem' }}>
            Магазин
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '520px', lineHeight: 1.5 }}>
            {info?.tagline || 'Мануалы, личные кабинеты банков и инструменты для питупишеров в P2P под казино.'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ваш баланс</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
            {balance.toLocaleString()} ₽
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setTab('catalog')} style={btnStyle(tab === 'catalog')}>
          Каталог
        </button>
        <button type="button" onClick={() => setTab('orders')} style={btnStyle(tab === 'orders')}>
          Мои заказы {orders.length > 0 && `(${orders.length})`}
        </button>
        <a
          href={TG_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...btnStyle(false),
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            textDecoration: 'none',
            marginLeft: 'auto',
          }}
        >
          <TelegramIcon size={18} />
          Канал
        </a>
      </div>

      {error && (
        <div
          style={{
            padding: '0.875rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '10px',
            color: 'var(--error)',
            marginBottom: '1rem',
            fontSize: '0.9rem',
          }}
        >
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
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-light)',
              }}
            >
              В этой категории пока нет товаров
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {CATEGORY_LABELS[p.category] || p.category}
                    </span>
                    {p.badge && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          background: 'var(--accent-soft)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '6px',
                        }}
                      >
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>
                    {p.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>
                    {p.description}
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Выдача: {p.delivery}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>
                      {p.price.toLocaleString()} {p.currency || '₽'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setSelected(p);
                      }}
                      style={{
                        padding: '0.55rem 1rem',
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
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
            <div
              style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                padding: '3rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-light)',
              }}
            >
              Заказов пока нет
            </div>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-light)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Заказ #{o.id} · {new Date(o.createdAt).toLocaleString('ru')}
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>{o.productTitle}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{o.deliveryHint}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
                    {o.amount.toLocaleString()} {o.currency || '₽'}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      background: o.status === 'completed' ? 'var(--positive-soft)' : 'var(--accent-soft)',
                      color: o.status === 'completed' ? 'var(--positive)' : 'var(--accent)',
                    }}
                  >
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Модалка покупки */}
      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => !buying && setSelected(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-light)',
              padding: '1.75rem',
              maxWidth: '440px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>
              Подтверждение покупки
            </h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selected.title}</p>
            <div
              style={{
                background: 'var(--bg-card-hover)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.25rem',
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Сумма</span>
                <strong style={{ color: 'var(--text)' }}>
                  {selected.price.toLocaleString()} {selected.currency || '₽'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Баланс после</span>
                <strong style={{ color: balance >= selected.price ? 'var(--positive)' : 'var(--error)' }}>
                  {(balance - selected.price).toLocaleString()} ₽
                </strong>
              </div>
              <div>Выдача через {selected.delivery}. Менеджер: {info?.vendor || 'Arsyukha Podmoskovny'}</div>
            </div>
            {balance < selected.price && (
              <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Недостаточно средств. Пополните баланс в кошельке.
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={buying || balance < selected.price}
                onClick={handleBuy}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: buying || balance < selected.price ? 'var(--bg-card-hover)' : 'var(--accent)',
                  color: buying || balance < selected.price ? 'var(--text-muted)' : '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: buying || balance < selected.price ? 'not-allowed' : 'pointer',
                }}
              >
                {buying ? 'Оформляем…' : 'Оплатить с баланса'}
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={buying}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Успешная покупка */}
      {successOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSuccessOrder(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              border: '1px solid var(--border-light)',
              padding: '2rem',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>
              Заказ #{successOrder.id} оформлен
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {successOrder.deliveryHint}
            </p>
            <a
              href={TG_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.875rem 1.5rem',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                marginBottom: '0.75rem',
              }}
            >
              <TelegramIcon size={22} />
              Написать в бот
            </a>
            <div>
              <button
                type="button"
                onClick={() => {
                  setSuccessOrder(null);
                  setTab('orders');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Перейти к заказам
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
