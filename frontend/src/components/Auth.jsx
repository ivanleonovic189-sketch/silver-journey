import { useState } from 'react';
import { API } from '../api';
import TelegramIcon from './TelegramIcon';
import EnterPayLogo from './EnterPayLogo';


export default function Auth({ onLogin, referralCode: initialReferralCode }) {
  const [isLogin, setIsLogin] = useState(true);
  const [referralCode] = useState(() => initialReferralCode || '');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    telegram: '',
    role: 'merchant',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const blockCopy = (e) => e.preventDefault();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const email = formData.email.trim();
    const password = formData.password;
    const name = formData.name.trim();
    const telegram = formData.telegram.trim();

    if (!email) {
      setError('Укажите email');
      return;
    }
    if (!password) {
      setError('Укажите пароль');
      return;
    }
    if (!isLogin) {
      if (!name) {
        setError('Укажите ник');
        return;
      }
      if (!telegram) {
        setError('Укажите Telegram');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin
        ? { email, password }
        : {
            email,
            password,
            name,
            telegram,
            role: formData.role,
            ...(referralCode && { referralCode }),
          };

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('enterPayToken', data.token);
        localStorage.setItem('enterPayUser', JSON.stringify(data.user));
        onLogin(data.user, data.token, { justRegistered: !isLogin });
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
    <div className="ep-auth-page">
      <div className="ep-auth-card">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            className="ep-no-copy"
            onCopy={blockCopy}
            onCut={blockCopy}
            onContextMenu={blockCopy}
            style={{ display: 'inline-flex', marginBottom: '1.75rem' }}
          >
            <EnterPayLogo size="md" />
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
              marginBottom: '0.4rem',
              letterSpacing: '-0.02em',
            }}
          >
            {isLogin ? 'С возвращением' : 'Создание аккаунта'}
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              margin: 0,
            }}
          >
            {isLogin ? 'Войдите, чтобы продолжить работу' : 'Заполните данные, чтобы начать'}
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

        <form
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          data-bwignore
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}
        >
          <input type="text" name="prevent_autofill" autoComplete="username" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />
          <input type="password" name="prevent_autofill_pass" autoComplete="new-password" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} />
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
                  Ник
                </label>
                <input
                  type="text"
                  name="enterpay_nick"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore
                  readOnly
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
                  placeholder="Ваш ник"
                  onFocus={(e) => {
                    e.target.removeAttribute('readonly');
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
                  <TelegramIcon size={24} />
                  Telegram
                </label>
                <input
                  type="text"
                  name="enterpay_telegram"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore
                  readOnly
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
                    e.target.removeAttribute('readonly');
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
                    { value: 'shop', label: 'Магазин', disabled: true },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => {
                        if (!option.disabled) {
                          setFormData({ ...formData, role: option.value });
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '0.875rem 1rem',
                        background: formData.role === option.value ? 'var(--bg-card)' : 'var(--bg-card-hover)',
                        border: formData.role === option.value ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                        borderRadius: '8px',
                        color: option.disabled ? 'var(--text-light)' : formData.role === option.value ? 'var(--text)' : 'var(--text-muted)',
                        fontWeight: formData.role === option.value ? 600 : 400,
                        cursor: option.disabled ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        transition: 'all 0.15s',
                        boxShadow: formData.role === option.value ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
                        opacity: option.disabled ? 0.55 : 1,
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
              name="enterpay_email"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              readOnly
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
                e.target.removeAttribute('readonly');
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
              name="enterpay_secret"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              readOnly
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
                e.target.removeAttribute('readonly');
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
              color: loading ? 'var(--text-muted)' : '#fff',
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
