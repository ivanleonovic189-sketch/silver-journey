import { useState, useEffect, useCallback } from 'react';
import { API } from '../../api';
import CodeHighlight, { LANG_TO_HL } from './CodeHighlight';

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

const sectionStyle = {
  background: 'var(--bg-card)',
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid var(--border-light)',
  marginBottom: '1rem',
};

function CodeBlock({ children, language = 'json' }) {
  const code = typeof children === 'string' ? children : String(children ?? '');
  return <CodeHighlight code={code} language={language} />;
}

const codeInline = {
  color: 'var(--text)',
  background: 'var(--bg-card-hover)',
  padding: '0.12rem 0.4rem',
  borderRadius: '4px',
  fontSize: '0.88em',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

const h3Style = { fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.5rem' };
const pStyle = { color: 'var(--text)', fontSize: '0.9rem', margin: '0 0 0.75rem', lineHeight: 1.55, opacity: 0.88 };
const liStyle = { marginBottom: '0.5rem', color: 'var(--text)', opacity: 0.88 };
const badgeStyle = {
  display: 'inline-block',
  padding: '0.15rem 0.5rem',
  borderRadius: '4px',
  fontSize: '0.72rem',
  fontWeight: 700,
  marginRight: '0.5rem',
  fontFamily: 'monospace',
};

function MethodBadge({ method, color = '#3b82f6' }) {
  return (
    <span style={{ ...badgeStyle, background: `${color}22`, color }}>
      {method}
    </span>
  );
}

function Code({ children }) {
  return <code style={codeInline}>{children}</code>;
}

function LangExamples({ examples, copied, onCopy }) {
  const langs = Object.keys(examples);
  const [active, setActive] = useState(langs[0]);

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {langs.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setActive(lang)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: `1px solid ${active === lang ? 'var(--accent)' : 'var(--border-light)'}`,
              background: active === lang ? 'var(--accent)' : 'var(--bg-card-hover)',
              color: active === lang ? '#fff' : 'var(--text)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {lang}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onCopy(examples[active], `lang-${active}`)}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid var(--border-light)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          {copied === `lang-${active}` ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <CodeHighlight
        code={examples[active]}
        language={LANG_TO_HL[active] || 'bash'}
      />
    </div>
  );
}

function Endpoint({ method, path, children }) {
  const colors = { GET: '#22c55e', POST: '#3b82f6', PATCH: '#f59e0b' };
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <div style={{ marginBottom: '0.35rem' }}>
        <MethodBadge method={method} color={colors[method] || '#888'} />
        <code style={{ ...codeInline, fontSize: '0.85rem' }}>{path}</code>
      </div>
      {children}
    </div>
  );
}

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

  const apiBase =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app';
  const merchantId = integration?.merchantId || stats?.merchantId || 'YOUR_MERCHANT_ID';
  const apiKey = integration?.apiKey || 'YOUR_API_KEY';
  const authHeader = `-H "Authorization: Bearer ${apiKey}"`;

  const payoutExamples = {
    cURL: `curl -X POST ${apiBase}/api/payout-requests \\
  ${authHeader} \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "paymentMethod": "sbp",
    "bank": "Сбербанк",
    "requisites": "+79001234567",
    "externalId": "player_123"
  }'`,
    'Node.js': `const res = await fetch('${apiBase}/api/payout-requests', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 5000,
    paymentMethod: 'sbp',
    bank: 'Сбербанк',
    requisites: '+79001234567',
    externalId: 'player_123',
  }),
});
const data = await res.json();
console.log(data);`,
    Python: `import requests

response = requests.post(
    '${apiBase}/api/payout-requests',
    headers={
        'Authorization': 'Bearer ${apiKey}',
        'Content-Type': 'application/json',
    },
    json={
        'amount': 5000,
        'paymentMethod': 'sbp',
        'bank': 'Сбербанк',
        'requisites': '+79001234567',
        'externalId': 'player_123',
    },
)
print(response.json())`,
    PHP: `<?php
$ch = curl_init('${apiBase}/api/payout-requests');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ${apiKey}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => 5000,
        'paymentMethod' => 'sbp',
        'bank' => 'Сбербанк',
        'requisites' => '+79001234567',
        'externalId' => 'player_123',
    ]),
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
    Go: `package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

func main() {
    body, _ := json.Marshal(map[string]interface{}{
        "amount": 5000,
        "paymentMethod": "sbp",
        "bank": "Сбербанк",
        "requisites": "+79001234567",
        "externalId": "player_123",
    })
    req, _ := http.NewRequest("POST", "${apiBase}/api/payout-requests", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer ${apiKey}")
    req.Header.Set("Content-Type", "application/json")
    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()
}`,
  };

  const appealExamples = {
    cURL: `curl -X POST ${apiBase}/api/shop-appeals \\
  ${authHeader} \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "withdrawal",
    "payoutRequestId": 42,
    "id": "player_123",
    "amount": 5000,
    "description": "Игрок не получил выплату на карту"
  }'`,
    'Node.js': `await fetch('${apiBase}/api/shop-appeals', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'withdrawal',
    payoutRequestId: 42,
    id: 'player_123',
    amount: 5000,
    description: 'Игрок не получил выплату на карту',
  }),
});`,
    Python: `requests.post(
    '${apiBase}/api/shop-appeals',
    headers={'Authorization': 'Bearer ${apiKey}'},
    json={
        'type': 'withdrawal',
        'payoutRequestId': 42,
        'id': 'player_123',
        'amount': 5000,
        'description': 'Игрок не получил выплату на карту',
    },
)`,
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
        API
      </h2>

      {/* Keys */}
      <div style={sectionStyle}>
        <h3 style={h3Style}>Ключи доступа</h3>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Merchant ID
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input style={inputStyle} readOnly value={String(merchantId)} />
            <button
              type="button"
              onClick={() => copy(String(merchantId), 'mid')}
              style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card-hover)', cursor: 'pointer', color: 'var(--text)' }}
            >
              {copied === 'mid' ? 'OK' : 'Копировать'}
            </button>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            API Key
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: '200px' }}
              readOnly
              type={showKey ? 'text' : 'password'}
              value={integration?.apiKey || ''}
            />
            <button type="button" onClick={() => setShowKey(!showKey)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card-hover)', cursor: 'pointer', color: 'var(--text)' }}>
              {showKey ? 'Скрыть' : 'Показать'}
            </button>
            <button type="button" onClick={() => copy(integration?.apiKey, 'key')} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--accent)', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
              {copied === 'key' ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        </div>
      </div>

      {/* Auth */}
      <div style={sectionStyle}>
        <h3 style={h3Style}>Авторизация</h3>
        <CodeBlock language="http">{`Authorization: Bearer ${apiKey}
Content-Type: application/json`}</CodeBlock>
      </div>

      {/* Endpoints */}
      <div style={sectionStyle}>
        <h3 style={h3Style}>Эндпоинты</h3>

        <Endpoint method="POST" path="/api/payout-requests">
          <p style={pStyle}>Создать заявку на вывод игрока.</p>
          <p style={{ ...pStyle, marginBottom: '0.35rem' }}><strong style={{ color: 'var(--text)' }}>Тело запроса:</strong></p>
          <CodeBlock language="javascript">{`{
  "amount": 5000,              // сумма в ₽, минимум 100
  "paymentMethod": "sbp",      // "sbp" или "card_ru"
  "bank": "Сбербанк",          // название банка (рекомендуется)
  "requisites": "+79001234567", // телефон СБП или номер карты
  "externalId": "player_123",  // ваш ID игрока (для связи с апелляциями)
  "currency": "₽"              // необязательно, по умолчанию ₽
}`}</CodeBlock>
          <p style={{ ...pStyle, marginTop: '0.75rem' }}><strong style={{ color: 'var(--text)' }}>Примеры кода:</strong></p>
          <LangExamples examples={payoutExamples} copied={copied} onCopy={copy} />
          <p style={{ ...pStyle, marginTop: '0.75rem' }}><strong style={{ color: 'var(--text)' }}>Ответ 201:</strong></p>
          <CodeBlock language="json">{`{
  "id": 42,
  "amount": 5000,
  "currency": "₽",
  "paymentMethod": "sbp",
  "status": "pending",
  "externalId": "player_123",
  "createdAt": "2026-06-05T12:00:00.000Z"
}`}</CodeBlock>
          <p style={{ ...pStyle, marginTop: '0.5rem' }}>
            Статусы вывода: <Code>pending</Code>, <Code>in_progress</Code>, <Code>completed</Code>, <Code>cancelled</Code>.
          </p>
        </Endpoint>

        <Endpoint method="GET" path="/api/payout-requests?status=all">
          <p style={pStyle}>Список заявок на вывод с вашего сайта. Параметр <Code>status</Code>: pending, in_progress, completed, cancelled или all.</p>
          <CodeBlock language="bash">{`curl "${apiBase}/api/payout-requests?status=all" \\
  ${authHeader}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/stats">
          <p style={pStyle}>Сводная статистика: баланс, количество выводов, объемы пополнений, апелляции.</p>
          <CodeBlock language="bash">{`curl "${apiBase}/api/stats" \\
  ${authHeader}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/payment-methods">
          <p style={pStyle}>Доступные методы оплаты: СБП (<Code>sbp</Code>) и карта РФ (<Code>card_ru</Code>).</p>
        </Endpoint>

        <Endpoint method="POST" path="/api/shop-appeals">
          <p style={pStyle}>
            Создать апелляцию, если игрок не получил выплату, депозит.
          </p>
          <CodeBlock language="javascript">{`{
  "type": "withdrawal",        // "withdrawal" | "deposit" | "other"
  "payoutRequestId": 42,       // необязательно, ID заявки на вывод
  "id": "player_123",          // необязательно, id игрока на вашем сайте
  "amount": 5000,              // необязательно, сумма спора
  "description": "Игрок не получил выплату на карту, прошло 3 часа"
}`}</CodeBlock>
          <LangExamples examples={appealExamples} copied={copied} onCopy={copy} />
          <p style={{ ...pStyle, marginTop: '0.5rem' }}>
            Статусы апелляции: <Code>pending</Code>, <Code>in_review</Code>, <Code>resolved</Code>, <Code>rejected</Code>.
          </p>
        </Endpoint>

        <Endpoint method="GET" path="/api/shop-appeals?status=all">
          <p style={pStyle}>Список апелляций вашего сайта.</p>
        </Endpoint>

        <Endpoint method="POST" path="/api/transactions/deposit">
          <p style={pStyle}>Создать депозит игрока.</p>
          <CodeBlock language="json">{`{
  "merchantId": ${merchantId},
  "userId": "player_123",
  "amount": 1000,
  "currency": "₽",
  "paymentMethod": "sbp",
  "metadata": { "orderId": "ord_99" }
}`}</CodeBlock>
        </Endpoint>

        <Endpoint method="GET" path="/api/transactions">
          <p style={pStyle}>
            История транзакций мерчанта. Фильтры: <Code>?status=pending</Code>, <Code>?userId=player_123</Code>.
          </p>
        </Endpoint>
      </div>

      {/* Webhooks */}
      <div style={sectionStyle}>
        <h3 style={h3Style}>Webhooks</h3>
        <p style={pStyle}>
          В разделе «Настройки», «Постбэки» укажите URL вашего сервера.
        </p>
        <ul style={{ ...pStyle, paddingLeft: '1.25rem' }}>
          <li style={liStyle}><Code>postbackDeposit</Code>: успешное пополнение</li>
          <li style={liStyle}><Code>postbackFirstDeposit</Code>: первый депозит игрока</li>
          <li style={liStyle}><Code>postbackWithdraw</Code>: завершенный вывод</li>
          <li style={liStyle}><Code>postbackChargeback</Code>: чарджбэк / спор</li>
        </ul>
        <CodeBlock language="bash">{`# Пример URL постбэка (настройте в кабинете):
https://shop.com/enterpay/callback?event=withdraw&amount=5000&externalId=player_123&status=completed&secret=YOUR_SECRET`}</CodeBlock>
      </div>

      {/* Errors */}
      <div style={sectionStyle}>
        <h3 style={h3Style}>Коды ответов и ошибки</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            {[
              ['200 / 201', 'Успех'],
              ['400', 'Неверные параметры (сумма, paymentMethod, описание апелляции)'],
              ['401', 'Нет или неверный API Key / токен'],
              ['403', 'Аккаунт не верифицирован, IP не в whitelist, нет прав'],
              ['404', 'Заявка или апелляция не найдена'],
            ].map(([code, desc]) => (
              <tr key={code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '0.5rem 0.75rem 0.5rem 0', color: 'var(--accent)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{code}</td>
                <td style={{ padding: '0.5rem 0', color: 'var(--text)', opacity: 0.85 }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
