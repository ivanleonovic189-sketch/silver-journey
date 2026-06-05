import { useState, useEffect, useCallback } from 'react';
import { API } from '../api';

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
  integrationMethod: 'h2h',
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    telegram: user?.telegram || '',
    role: user?.role || '',
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [integration, setIntegration] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    setLoadFailed(false);
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'x-auth-token': token,
      };
      const res = await fetch(`${API}/api/settings`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error('load failed');
      }
      setProfile(data.profile || {});
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
      setIntegration(data.integration || null);
    } catch (e) {
      console.error(e);
      setLoadFailed(true);
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
    setMessage('');
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, profile: { name: profile.name, telegram: profile.telegram } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('save failed');
      setProfile(data.profile);
      setSettings(data.settings);
      setMessage('Настройки сохранены');
      onUserUpdate?.(data.profile);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      // silent
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

  const isShop = profile.role === 'shop';
  const isMerchant = profile.role === 'merchant';
  const roleLabel = isShop ? 'Магазин' : isMerchant ? 'Мерчант' : profile.role;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
        Настройки
      </h2>
      {!isShop && (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', marginTop: '-0.75rem' }}>
          Профиль, уведомления и параметры приема выплат.
        </p>
      )}

      {message && (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--positive-soft)', border: '1px solid var(--positive)', borderRadius: '8px', color: 'var(--positive)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}
      {loadFailed && (
            <button
              type="button"
              onClick={loadSettings}
              style={{
                display: 'block',
                marginBottom: '1rem',
                padding: '0.4rem 0.75rem',
                background: 'transparent',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Повторить загрузку
            </button>
          )}

      <Section title="Профиль">
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
          <Section title="Сайт и трафик">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>URL сайта</label>
                <input
                  style={inputStyle}
                  value={settings.casinoSiteUrl}
                  onChange={(e) => updateSetting('casinoSiteUrl', e.target.value)}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>SubID</label>
                  <input
                    style={inputStyle}
                    value={settings.defaultSubId}
                    onChange={(e) => updateSetting('defaultSubId', e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Источник</label>
                  <input
                    style={inputStyle}
                    value={settings.trackingSource}
                    onChange={(e) => updateSetting('trackingSource', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Гео трафика</label>
                <input
                  style={inputStyle}
                  value={settings.trafficGeo}
                  onChange={(e) => updateSetting('trafficGeo', e.target.value)}
                />
              </div>
            </div>
          </Section>

          <Section title="Постбэки">
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Postback URL</label>
              <input
                style={inputStyle}
                value={settings.postbackUrl}
                onChange={(e) => updateSetting('postbackUrl', e.target.value)}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Секрет постбэка</label>
              <input
                style={inputStyle}
                value={settings.postbackSecret}
                onChange={(e) => updateSetting('postbackSecret', e.target.value)}
              />
            </div>
            <Toggle checked={settings.postbackDeposit} onChange={(v) => updateSetting('postbackDeposit', v)} label="Депозит (deposit)" hint="Игрок пополнил баланс" />
            <Toggle checked={settings.postbackFirstDeposit} onChange={(v) => updateSetting('postbackFirstDeposit', v)} label="Первый депозит (FTD)" hint="Первое пополнение нового игрока" />
            <Toggle checked={settings.postbackWithdraw} onChange={(v) => updateSetting('postbackWithdraw', v)} label="Вывод (withdraw)" />
            <Toggle checked={settings.postbackChargeback} onChange={(v) => updateSetting('postbackChargeback', v)} label="Чарджбэк / отмена" />
          </Section>
        </>
      )}

      {isMerchant && (
        <Section title="Выплаты" description="Поведение при приеме заявок на вывод с казино.">
          <Toggle
            checked={settings.autoAcceptPayouts}
            onChange={(v) => updateSetting('autoAcceptPayouts', v)}
            label="Автопринятие заявок"
            hint="Сразу брать заявку в работу (осторожно при high-risk)"
          />
          <div style={{ marginTop: '0.75rem' }}>
            <label style={labelStyle}>Холд перед подтверждением (часов, 0-168)</label>
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
        <Section title="API">
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Метод подключения</label>
            <select
              className="ep-select"
              style={{ ...inputStyle, paddingRight: '2.5rem' }}
              value={settings.integrationMethod || 'h2h'}
              onChange={(e) => updateSetting('integrationMethod', e.target.value)}
            >
              <option value="h2h">H2H</option>
              <option value="p2p">P2P</option>
            </select>
          </div>
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
            <label style={labelStyle}>Белый список IP для API</label>
            <input
              style={inputStyle}
              value={settings.apiIpWhitelist}
              onChange={(e) => updateSetting('apiIpWhitelist', e.target.value)}
            />
          </div>
        </Section>
      )}

      <div style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            width: '100%',
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
