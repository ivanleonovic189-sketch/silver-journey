import { useState, useEffect } from 'react';
import { API } from '../api';
import { PayoutsIcon } from './Icons';

const PAYMENT_LABELS = { card_ru: 'Банковская карта РФ', sbp: 'СБП' };

export default function Payouts({
  payoutRequests,
  paymentMethods,
  user,
  onAccept,
  onComplete,
  onCancel,
  getAuthHeaders,
}) {
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequisites, setShowRequisites] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptError, setReceiptError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelDelay, setCancelDelay] = useState(10);

  const handleCopyRequisites = (text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fetchFiltered = async () => {
    if (!getAuthHeaders) return [];
    const params = new URLSearchParams();
    if (amountFrom) params.set('amountFrom', amountFrom);
    if (amountTo) params.set('amountTo', amountTo);
    if (paymentFilter) params.set('paymentMethod', paymentFilter);
    params.set('status', 'pending');
    const res = await fetch(`${API}/api/payout-requests?${params}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return res.json();
    return [];
  };

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptedRequest, setAcceptedRequest] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchFiltered().then((data) => {
      setRequests(data);
      setLoading(false);
    });
  }, [amountFrom, amountTo, paymentFilter, payoutRequests]);

  const handleAccept = async (req) => {
    if (!onAccept) return;
    const updated = await onAccept(req.id);
    if (updated) {
      setAcceptedRequest(updated);
      setSelectedRequest(updated);
      setShowRequisites(true);
      setTimeLeft(20 * 60);
    }
  };

  useEffect(() => {
    if (!showRequisites || !selectedRequest) return;
    const req = selectedRequest;
    const expiresAt = new Date(req.expiresAt || 0).getTime();
    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        setShowRequisites(false);
        setSelectedRequest(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showRequisites, selectedRequest, payoutRequests]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setReceiptError('');
    if (!f) {
      setReceiptFile(null);
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(f.type)) {
      setReceiptError('Загрузите PDF, JPG или JPEG');
      setReceiptFile(null);
      return;
    }
    setReceiptFile(f);
  };

  const handleComplete = async () => {
    if (!receiptFile || !selectedRequest || !onComplete) return;
    setReceiptError('');
    setSubmitting(true);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result?.split(',')[1];
        const ok = await onComplete(selectedRequest.id, base64);
        setSubmitting(false);
        if (ok) {
          setShowRequisites(false);
          setSelectedRequest(null);
          setAcceptedRequest(null);
          setReceiptFile(null);
        }
        resolve(ok);
      };
      reader.readAsDataURL(receiptFile);
    });
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getPaymentName = (id) => PAYMENT_LABELS[id] || paymentMethods?.find((m) => m.id === id)?.name || id;
  const getMethodWithBank = (req) => {
    const base = getPaymentName(req.paymentMethod);
    if (req.bank) return req.paymentMethod === 'sbp' ? `СБП (${req.bank})` : `${base} (${req.bank})`;
    return base;
  };

  const inProgressRequest = acceptedRequest?.status === 'in_progress'
    ? acceptedRequest
    : payoutRequests?.find((r) => r.status === 'in_progress' && r.traderId === user?.id) || null;

  useEffect(() => {
    if (inProgressRequest && !showRequisites && !acceptedRequest) {
      setSelectedRequest(inProgressRequest);
      setAcceptedRequest(inProgressRequest);
      setShowRequisites(true);
    }
  }, [inProgressRequest?.id]);

  useEffect(() => {
    if (!showCancelModal || cancelDelay <= 0) return;
    const id = setInterval(() => setCancelDelay((d) => Math.max(0, d - 1)), 1000);
    return () => clearInterval(id);
  }, [showCancelModal, cancelDelay]);

  const doCancel = async () => {
    if (onCancel) await onCancel(selectedRequest.id);
    setShowRequisites(false);
    setSelectedRequest(null);
    setAcceptedRequest(null);
    setReceiptFile(null);
    setShowCancelModal(false);
    setCancelDelay(10);
  };

  // Отдельная страница: оплата заявки — на всю ширину
  if (showRequisites && selectedRequest) {
    const req = selectedRequest;
    return (
      <div style={{ width: '100%' }}>
        <button
          onClick={() => { setCancelDelay(10); setShowCancelModal(true); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem',
            padding: '0.5rem 0',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--green)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          ← Назад к списку
        </button>

        <div data-payout-form-grid style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          minHeight: '400px',
        }}>
          {/* Левая часть: данные заявки */}
          <div style={{
            padding: '2rem',
            borderRight: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Заявка #{req.id}</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green)' }}>{req.amount.toLocaleString()} ₽</div>
              </div>
              <div style={{
                padding: '0.75rem 1.25rem',
                background: timeLeft <= 60 ? 'rgba(239, 83, 80, 0.2)' : 'rgba(255, 184, 77, 0.15)',
                borderRadius: '12px',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 700,
                fontSize: '1.5rem',
                color: timeLeft <= 60 ? 'var(--error)' : 'var(--warning)',
              }}>
                {formatTime(timeLeft || 0)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Банк</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>{req.bank || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Метод оплаты</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text)' }}>{getPaymentName(req.paymentMethod)}</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Реквизиты</div>
              <div
                onClick={() => handleCopyRequisites(req.requisites)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCopyRequisites(req.requisites)}
                style={{
                  padding: '1.25rem',
                  background: 'var(--bg-deep)',
                  borderRadius: '14px',
                  fontFamily: 'monospace',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                  letterSpacing: '0.05em',
                  border: '2px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginTop: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--green)';
                  e.currentTarget.style.background = 'rgba(0, 255, 136, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-deep)';
                }}
              >
                {req.requisites}
                <div style={{ fontSize: '0.8rem', color: copied ? 'var(--green)' : 'var(--text-muted)', marginTop: '0.5rem' }}>
                  {copied ? 'Скопировано!' : 'Нажмите, чтобы скопировать'}
                </div>
              </div>
            </div>
          </div>

          {/* Правая часть: загрузка чека */}
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>Загрузите чек</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>PDF, JPG или JPEG</p>
            <label style={{
              display: 'block',
              padding: '2rem',
              background: 'var(--bg-deep)',
              border: `2px dashed ${receiptFile ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: '12px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '0.5rem',
            }}>
              <input type="file" accept="application/pdf,image/jpeg,image/jpg" onChange={handleFileChange} style={{ display: 'none' }} />
              {receiptFile ? (
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>&#10003; {receiptFile.name}</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Выберите файл</span>
              )}
            </label>
            {receiptError && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem' }}>{receiptError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={handleComplete}
                disabled={!receiptFile || submitting}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: receiptFile && !submitting ? 'var(--green)' : 'var(--bg-card-hover)',
                  color: receiptFile && !submitting ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  cursor: receiptFile && !submitting ? 'pointer' : 'not-allowed',
                  fontSize: '1rem',
                }}
              >
                {submitting ? 'Отправка...' : 'Отправить чек'}
              </button>
              <button
                onClick={() => { setCancelDelay(10); setShowCancelModal(true); }}
                style={{
                  padding: '1rem 1.25rem',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 768px) {
            [data-payout-form-grid] { grid-template-columns: 1fr !important; }
            [data-payout-form-grid] > div:first-child { border-right: none !important; border-bottom: 1px solid var(--border-light) !important; }
          }
        `}</style>

        {/* Модалка подтверждения отмены */}
        {showCancelModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowCancelModal(false)}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                padding: '2rem',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                maxWidth: '400px',
                width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
                Вы уверены, что хотите отменить?
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Заявка будет возвращена в общий список. Кнопка отмены станет доступна через {cancelDelay} сек.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowCancelModal(false); setCancelDelay(10); }}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'var(--bg-deep)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Нет
                </button>
                <button
                  onClick={doCancel}
                  disabled={cancelDelay > 0}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: cancelDelay > 0 ? 'var(--bg-card-hover)' : 'var(--error)',
                    color: cancelDelay > 0 ? 'var(--text-muted)' : '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 600,
                    cursor: cancelDelay > 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelDelay > 0 ? `Отменить (${cancelDelay})` : 'Да, отменить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Список заявок
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>
          Выплаты
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Заявки на вывод от сторонних пользователей. Примите заявку, переведите деньги и загрузите чек — получите +1% к балансу
        </p>
      </div>

      {/* Поиск по сумме */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Сумма от, ₽</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={amountFrom}
            onChange={(e) => setAmountFrom(e.target.value.replace(/\D/g, ''))}
            style={{
              width: '120px',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.9rem',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Сумма до, ₽</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="∞"
            value={amountTo}
            onChange={(e) => setAmountTo(e.target.value.replace(/\D/g, ''))}
            style={{
              width: '120px',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.9rem',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Метод</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '0.9rem',
              minWidth: '180px',
            }}
          >
            <option value="">Все методы</option>
            {paymentMethods?.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Список заявок */}
      <section style={{
        background: 'var(--bg-card)',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Загрузка...</div>
        ) : requests.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '4rem 2rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '1rem', opacity: 0.5 }}>
              <PayoutsIcon size={48} color="var(--text-muted)" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Нет доступных заявок</div>
            <div style={{ fontSize: '0.9rem' }}>Попробуйте изменить фильтры по сумме</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {requests.map((req) => (
              <div
                key={req.id}
                style={{
                  padding: '1.25rem',
                  background: 'var(--bg-deep)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-deep)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>ID</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>#{req.id}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Сумма</div>
                    <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '1.1rem' }}>
                      {req.amount.toLocaleString()} {req.currency || '₽'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Метод</div>
                    <div style={{ fontWeight: 500, color: 'var(--text)' }}>{getMethodWithBank(req)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ваш доход</div>
                    <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: '0.95rem' }}>
                      +{Math.round(req.amount * 0.01).toLocaleString()} ₽ (1%)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleAccept(req)}
                  disabled={!!inProgressRequest}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: inProgressRequest ? 'var(--bg-card-hover)' : 'var(--accent)',
                    color: inProgressRequest ? 'var(--text-muted)' : '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: inProgressRequest ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: inProgressRequest ? 'none' : '0 2px 8px rgba(232, 93, 4, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    if (!inProgressRequest) {
                      e.currentTarget.style.background = 'var(--accent-hover)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!inProgressRequest) {
                      e.currentTarget.style.background = 'var(--accent)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {inProgressRequest ? 'Есть активная заявка' : 'Принять'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
