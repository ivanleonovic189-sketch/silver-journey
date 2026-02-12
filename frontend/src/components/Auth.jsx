import { useState } from 'react';
import { API } from '../api';
import TelegramIcon from './TelegramIcon';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    telegram: '',
    role: 'merchant',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin
        ? { email: formData.email, password: formData.password }
        : {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            telegram: formData.telegram,
            role: formData.role,
          };

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('shipPayToken', data.token);
        localStorage.setItem('shipPayUser', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      } else {
        setError(data.error || 'Ошибка авторизации');
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-light)',
          padding: '3rem',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em',
            }}
          >
            Ship Pay
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              fontWeight: 500,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            High-Risk платёжная система
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '2.5rem',
            background: 'var(--bg-card-hover)',
            padding: '0.5rem',
            borderRadius: '10px',
            border: '1px solid var(--border-light)',
          }}
        >
          <button
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
            style={{
              flex: 1,
              padding: '0.875rem 1.25rem',
              background: isLogin ? 'var(--bg-card)' : 'transparent',
              color: isLogin ? 'var(--text)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: isLogin ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'all 0.15s',
              boxShadow: isLogin ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
            }}
          >
            Вход
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
            style={{
              flex: 1,
              padding: '0.875rem 1.25rem',
              background: !isLogin ? 'var(--bg-card)' : 'transparent',
              color: !isLogin ? 'var(--text)' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: !isLogin ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'all 0.15s',
              boxShadow: !isLogin ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
            }}
          >
            Регистрация
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: 'var(--error)',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!isLogin && (
            <>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                  }}
                >
                  Имя
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    transition: 'all 0.15s',
                    outline: 'none',
                  }}
                  placeholder="Ваше имя"
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                    e.target.style.background = 'var(--bg-card)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-light)';
                    e.target.style.background = 'var(--bg-card-hover)';
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                  }}
                >
                  <TelegramIcon size={16} color="var(--text-muted)" />
                  Telegram
                </label>
                <input
                  type="text"
                  required
                  value={formData.telegram}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    transition: 'all 0.15s',
                    outline: 'none',
                  }}
                  placeholder="@username"
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent)';
                    e.target.style.background = 'var(--bg-card)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-light)';
                    e.target.style.background = 'var(--bg-card-hover)';
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                  }}
                >
                  Роль
                </label>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                  }}
                >
                  {[
                    { value: 'merchant', label: 'Мерчант' },
                    { value: 'shop', label: 'Магазин' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: option.value })}
                      style={{
                        flex: 1,
                        padding: '0.875rem 1rem',
                        background: formData.role === option.value ? 'var(--bg-card)' : 'var(--bg-card-hover)',
                        border: formData.role === option.value ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                        borderRadius: '8px',
                        color: formData.role === option.value ? 'var(--text)' : 'var(--text-muted)',
                        fontWeight: formData.role === option.value ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        transition: 'all 0.15s',
                        boxShadow: formData.role === option.value ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
                fontWeight: 500,
              }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.95rem',
                transition: 'all 0.15s',
                outline: 'none',
              }}
              placeholder="your@email.com"
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.background = 'var(--bg-card)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-light)';
                e.target.style.background = 'var(--bg-card-hover)';
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
                fontWeight: 500,
              }}
            >
              Пароль
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.95rem',
                transition: 'all 0.15s',
                outline: 'none',
              }}
              placeholder="••••••••"
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.background = 'var(--bg-card)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-light)';
                e.target.style.background = 'var(--bg-card-hover)';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? 'var(--bg-card-hover)' : 'var(--accent)',
              color: loading ? 'var(--text-muted)' : 'var(--bg-card)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
              marginTop: '0.5rem',
              transition: 'all 0.15s',
              boxShadow: loading ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.background = 'var(--accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.background = 'var(--accent)';
              }
            }}
          >
            {loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}
