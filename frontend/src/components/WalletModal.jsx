import { useState } from 'react';
import { ShieldIcon, CoinIcon, PlusIcon, ArrowRightIcon } from './Icons';

export default function WalletModal({ user, stats, onClose, onReplenish, onWithdraw }) {
  const [activeAction, setActiveAction] = useState(null); // 'replenish' or 'withdraw'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-light)',
          padding: '2rem',
          width: '90%',
          maxWidth: '420px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Кошелек
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--bg-card-hover)';
              e.target.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = 'var(--text-muted)';
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Балансы - горизонтально */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Страховой депозит - пополнения вручную */}
          <div
            style={{
              flex: 1,
              background: 'var(--bg-card-hover)',
              borderRadius: '10px',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <ShieldIcon size={24} color="var(--text-muted)" />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Страховой депозит
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
              {(stats?.insuranceDeposit ?? 0).toLocaleString()} ₽
            </div>
          </div>

          {/* Рабочий депозит - с выплат */}
          <div
            style={{
              flex: 1,
              background: 'var(--bg-card-hover)',
              borderRadius: '10px',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <CoinIcon size={24} color="var(--text-muted)" />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Рабочий депозит
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
              {(stats?.workingDeposit ?? 0).toLocaleString()} ₽
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Общий баланс: <strong style={{ color: 'var(--text)' }}>{(stats?.balance ?? 0).toLocaleString()} ₽</strong>
        </div>

        {/* Пополнить */}
        <button
          onClick={() => {
            setActiveAction('replenish');
            if (onReplenish) onReplenish();
          }}
          style={{
            width: '100%',
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-light)',
            borderRadius: '10px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: '0.75rem',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-card-hover)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlusIcon size={20} color="var(--accent)" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                Пополнить
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Пополнить баланс</div>
            </div>
          </div>
          <ArrowRightIcon size={20} color="var(--text-muted)" />
        </button>

        {/* Вывести */}
        <button
          onClick={() => {
            setActiveAction('withdraw');
            if (onWithdraw) onWithdraw();
          }}
          style={{
            width: '100%',
            background: 'var(--bg-card-hover)',
            border: '1px solid var(--border-light)',
            borderRadius: '10px',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-card-hover)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M19 7H5C3.89543 7 3 7.89543 3 9V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7Z"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 10H21"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 14C16.5523 14 17 13.5523 17 13C17 12.4477 16.5523 12 16 12C15.4477 12 15 12.4477 15 13C15 13.5523 15.4477 14 16 14Z"
                  fill="var(--accent)"
                />
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                Вывести
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Вывод средств</div>
            </div>
          </div>
          <ArrowRightIcon size={20} color="var(--text-muted)" />
        </button>
      </div>
    </div>
  );
}
