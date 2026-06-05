import { useState, useEffect, useCallback } from 'react';
import { API } from '../api';
import { TG_BOT_URL } from '../config';

const DEFAULT_SETTINGS = {
  casinoSiteUrl: '',
  landingPageUrl: '',
  defaultSubId: '',
  trackingSource: '',
  trafficGeo: 'RU,CIS',
  postbackUrl: '',
  postbackDeposit: true,
  postbackFirstDeposit: true,
  postbackWithdraw: false,
  postbackChargeback: true,
  postbackSecret: '',
  notifyTelegramDeposits: true,
  notifyTelegramPayouts: true,
  notifyTelegramAppeals: true,
  notifyMinAmount: 1000,
  apiIpWhitelist: '',
  autoAcceptPayouts: false,
  holdPeriodHours: 0,
  revshareDisplay: true,
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  background: 'var(--bg-card-hover)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '0.95rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  marginBottom: '0.35rem',
  fontWeight: 600,
};

function Section({ title, description, children }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid var(--border-light)',
        marginBottom: '1rem',
      }}
    >
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: description ? '0.35rem' : '1rem' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{description}</p>
      )}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        cursor: 'pointer',
        marginBottom: '0.75rem',
        background: 'transparent',
        border: 'none',
        padding: 0,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span
        style={{
          width: '40px',
          height: '22px',
          background: checked ? 'var(--accent)' : 'var(--bg-card-hover)',
          borderRadius: '999px',
          position: 'relative',
          flexShrink: 0,
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-light)'}`,
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '20px' : '2px',
            width: '16px',
            height: '16px',
            background: '#fff',
            borderRadius: '50%',
            transition: 'left 0.2s',
          }}
        />
      </span>
      <span>
        <span style={{ fontSize: '0.9rem', color: 'var(--text)', display: 'block' }}>{label}</span>
        {hint && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{hint}</span>}
      </span>
    </button>
  );
}

export default function Settings({ getAuthHeaders, user, token, onUserUpdate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', telegram: '', role: '' });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [integration, setIntegration] = useState(null);
  const [telegram, setTelegram] = useState(null);
  const [linkCode, setLinkCode] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'x-auth-token': token,
      };
      const res = await fetch(`${API}/api/settings`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Не удалось загрузить настройки (${res.status})`);
      }
      setProfile(data.profile || {});
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
      setIntegration(data.integration || null);
      setTelegram(data.telegram || null);
    } catch (e) {
      console.error(e);
      setLoadFailed(true);
      setError(e.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, profile: { name: profile.name, telegram: profile.telegram } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
      setProfile(data.profile);
      setSettings(data.settings);
      setMessage('Настройки сохранены');
      onUserUpdate?.(data.profile);
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const copyText = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const generateLinkCode = async () => {
    setLinkLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/telegram/link-code`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось получить код');
      setLinkCode(data);
    } catch (e) {
      setError(e.message || 'Ошибка');
    } finally {
      setLinkLoading(false);
    }
  };

  const unlinkTelegram = async () => {
    setLinkLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/telegram/unlink`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отвязки');
      setTelegram((t) => ({ ...t, linked: false, linkedAt: null }));
      setLinkCode(null);
      setMessage('Telegram отвязан');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.message || 'Ошибка отвязки');
    } finally {
      setLinkLoading(false);
    }
  };

  const botUrl = telegram?.botUrl || linkCode?.botUrl || TG_BOT_URL;

  if (loading) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 0' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
          Настройки
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Загрузка…</p>
      </div>
    );
  }

  const isShop = profile.role === 'shop';
  const isMerchant = profile.role === 'merchant';
  const roleLabel = isShop ? 'Казино (магазин)' : isMerchant ? 'Мерчант' : profile.role;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
        Настройки
      </h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        {isShop
          ? 'Параметры казино: сайт, трафик, постбэки и API.'
          : 'Профиль, уведомления и параметры приёма выплат.'}
      </p>

      {message && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--positive-soft)', border: '1px solid var(--positive)', borderRadius: '8px', color: 'var(--positive)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error}
          {loadFailed && (
            <button
              type="button"
              onClick={loadSettings}
              style={{
                display: 'block',
                marginTop: '0.5rem',
                padding: '0.4rem 0.75rem',
                background: 'transparent',
                border: '1px solid var(--error)',
                borderRadius: '6px',
                color: 'var(--error)',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Повторить
            </button>
          )}
        </div>
      )}

      <Section title="Профиль" description="Контакты для связи и уведомлений в Telegram.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Имя / ник</label>
            <input style={inputStyle} value={profile.name || ''} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={{ ...inputStyle, opacity: 0.7 }} value={profile.email || ''} readOnly />
          </div>
          <div>
            <label style={labelStyle}>Telegram</label>
            <input style={inputStyle} value={profile.telegram || ''} onChange={(e) => setProfile((p) => ({ ...p, telegram: e.target.value }))} placeholder="@username" />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Роль: <strong style={{ color: 'var(--text)' }}>{roleLabel}</strong>
          </div>
        </div>
      </Section>

      {isShop && (
        <>
          <Section title="Сайт и трафик" description="URL казино и параметры для отслеживания игроков.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>URL казино-сайта</label>
                <input
                  style={inputStyle}
                  value={settings.casinoSiteUrl}
                  onChange={(e) => updateSetting('casinoSiteUrl', e.target.value)}
                  placeholder="https://casino.example.com"
                />
              </div>
              <div>
                <label style={labelStyle}>Лендинг / промо-страница</label>
                <input
                  style={inputStyle}
                  value={settings.landingPageUrl}
                  onChange={(e) => updateSetting('landingPageUrl', e.target.value)}
                  placeholder="https://promo.example.com/welcome"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>SubID по умолчанию</label>
                  <input
                    style={inputStyle}
                    value={settings.defaultSubId}
                    onChange={(e) => updateSetting('defaultSubId', e.target.value)}
                    placeholder="pub_001"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Источник (source)</label>
                  <input
                    style={inputStyle}
                    value={settings.trackingSource}
                    onChange={(e) => updateSetting('trackingSource', e.target.value)}
                    placeholder="facebook, seo, push"
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Гео трафика</label>
                <input
                  style={inputStyle}
                  value={settings.trafficGeo}
                  onChange={(e) => updateSetting('trafficGeo', e.target.value)}
                  placeholder="RU,CIS,KZ"
                />
              </div>
            </div>
          </Section>

          <Section title="Постбэки" description="URL для отправки событий: депозит, первый депозит, вывод, чарджбэк.">
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Postback URL</label>
              <input
                style={inputStyle}
                value={settings.postbackUrl}
                onChange={(e) => updateSetting('postbackUrl', e.target.value)}
                placeholder="https://your-tracker.com/postback?click_id={click_id}"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Секрет постбэка (опционально)</label>
              <input
                style={inputStyle}
                value={settings.postbackSecret}
                onChange={(e) => updateSetting('postbackSecret', e.target.value)}
                placeholder="secret_key_for_signature"
              />
            </div>
            <Toggle checked={settings.postbackDeposit} onChange={(v) => updateSetting('postbackDeposit', v)} label="Депозит (deposit)" hint="Игрок пополнил баланс" />
            <Toggle checked={settings.postbackFirstDeposit} onChange={(v) => updateSetting('postbackFirstDeposit', v)} label="Первый депозит (FTD)" hint="Первое пополнение нового игрока" />
            <Toggle checked={settings.postbackWithdraw} onChange={(v) => updateSetting('postbackWithdraw', v)} label="Вывод (withdraw)" />
            <Toggle checked={settings.postbackChargeback} onChange={(v) => updateSetting('postbackChargeback', v)} label="Чарджбэк / отмена" />
          </Section>
        </>
      )}

      <Section
        title="Telegram-бот"
        description="Привяжите аккаунт для push-уведомлений и команд /balance, /stats, /payouts."
      >
        {!telegram?.configured ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
            Бот не настроен на сервере (нет TELEGRAM_BOT_TOKEN).
          </p>
        ) : telegram.linked ? (
          <div>
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--positive-soft)',
                border: '1px solid var(--positive)',
                borderRadius: '8px',
                color: 'var(--positive)',
                fontSize: '0.9rem',
                marginBottom: '1rem',
              }}
            >
              Привязан
              {telegram.linkedAt && (
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  с {new Date(telegram.linkedAt).toLocaleString('ru-RU')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '0.65rem 1.25rem',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Открыть бота
              </a>
              <button
                type="button"
                onClick={unlinkTelegram}
                disabled={linkLoading}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                  cursor: linkLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Отвязать
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              1. Получите код → 2. Откройте бота → 3. Отправьте /link КОД или нажмите ссылку с кодом.
            </p>
            {!linkCode ? (
              <button
                type="button"
                onClick={generateLinkCode}
                disabled={linkLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: linkLoading ? 'var(--bg-card-hover)' : 'var(--accent)',
                  color: linkLoading ? 'var(--text-muted)' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: linkLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {linkLoading ? 'Генерация...' : 'Получить код привязки'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Код (15 мин)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.15em' }} readOnly value={linkCode.code} />
                    <button
                      type="button"
                      onClick={() => copyText(linkCode.code, 'tgcode')}
                      style={{ padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      {copied === 'tgcode' ? 'OK' : 'Копировать'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <a
                    href={linkCode.botUrl || botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '0.65rem 1.25rem',
                      background: 'var(--accent)',
                      color: '#fff',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                    }}
                  >
                    Открыть бота с кодом
                  </a>
                  <button
                    type="button"
                    onClick={generateLinkCode}
                    disabled={linkLoading}
                    style={{
                      padding: '0.65rem 1.25rem',
                      background: 'transparent',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      cursor: linkLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Новый код
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Уведомления в Telegram"
        description={isMerchant ? 'Оповещения о заявках на выплату и апелляциях.' : 'Какие события дублировать в Telegram.'}
      >
        {isShop && (
          <Toggle checked={settings.notifyTelegramDeposits} onChange={(v) => updateSetting('notifyTelegramDeposits', v)} label="Депозиты и пополнения" />
        )}
        <Toggle checked={settings.notifyTelegramPayouts} onChange={(v) => updateSetting('notifyTelegramPayouts', v)} label="Выплаты и заявки" />
        <Toggle checked={settings.notifyTelegramAppeals} onChange={(v) => updateSetting('notifyTelegramAppeals', v)} label="Апелляции и споры" />
        <div style={{ marginTop: '0.75rem' }}>
          <label style={labelStyle}>Мин. сумма для уведомления (₽)</label>
          <input
            type="number"
            style={inputStyle}
            value={settings.notifyMinAmount}
            onChange={(e) => updateSetting('notifyMinAmount', e.target.value)}
            min={0}
          />
        </div>
      </Section>

      {isMerchant && (
        <Section title="Выплаты" description="Поведение при приёме заявок на вывод с казино.">
          <Toggle
            checked={settings.autoAcceptPayouts}
            onChange={(v) => updateSetting('autoAcceptPayouts', v)}
            label="Автопринятие заявок"
            hint="Сразу брать заявку в работу (осторожно при high-risk)"
          />
          <div style={{ marginTop: '0.75rem' }}>
            <label style={labelStyle}>Холд перед подтверждением (часов, 0–168)</label>
            <input
              type="number"
              style={inputStyle}
              value={settings.holdPeriodHours}
              onChange={(e) => updateSetting('holdPeriodHours', e.target.value)}
              min={0}
              max={168}
            />
          </div>
        </Section>
      )}

      {integration && isShop && (
        <Section title="API и интеграция" description="Ключи для подключения казино-сайта к Enter Pay (приём платежей и выплат через API).">
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Merchant ID</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input style={{ ...inputStyle, flex: 1 }} readOnly value={String(integration.merchantId)} />
              <button
                type="button"
                onClick={() => copyText(String(integration.merchantId), 'mid')}
                style={{ padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {copied === 'mid' ? 'OK' : 'Копировать'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
                readOnly
                type={showApiKey ? 'text' : 'password'}
                value={integration.apiKey || ''}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {showApiKey ? 'Скрыть' : 'Показать'}
              </button>
              <button
                type="button"
                onClick={() => copyText(integration.apiKey, 'key')}
                style={{ padding: '0.75rem 1rem', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {copied === 'key' ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Белый список IP для API (через запятую)</label>
            <input
              style={inputStyle}
              value={settings.apiIpWhitelist}
              onChange={(e) => updateSetting('apiIpWhitelist', e.target.value)}
              placeholder="185.0.0.1, 10.0.0.0/24"
            />
          </div>
        </Section>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: '0.85rem 2rem',
            background: saving ? 'var(--bg-card-hover)' : 'var(--accent)',
            color: saving ? 'var(--text-muted)' : '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '0.95rem',
          }}
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}
