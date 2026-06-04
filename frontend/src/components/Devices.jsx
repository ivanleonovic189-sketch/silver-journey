import { useState, useEffect } from 'react';

import { API } from '../api';
const TYPE_LABELS = { card_ru: 'Банковская карта', sbp: 'СБП' };
const RUSSIAN_BANKS = [
  'АБ РОССИЯ', 'Автоградбанк', 'Авангард', 'Азиатско-Тихоокеанский Банк', 'Ак Барс Банк', 'Альфа-Банк',
  'БАЛТИНВЕСТБАНК', 'Банк АЛЕКСАНДРОВСКИЙ', 'Банк Вологжанин', 'Банк Воронеж', 'Банк ДОМ.РФ',
  'Банк Дальневосточный', 'Банк Екатерининский', 'Банк Интеза', 'Банк НБС', 'Банк Объединенный капитал',
  'Банк Оранжевый', 'Банк Открытие', 'Банк ПСКБ', 'Банк Первомайский', 'Банк Репутация', 'Банк Россия',
  'Банк Санкт-Петербург', 'Банк Советский', 'Банк Ставр', 'Банк ТРАСТ', 'Банк Торжок', 'Банк Уралсиб',
  'Банк ЦентроКредит', 'Банк Энергомаш', 'Банк Возрождение', 'Байкалкредобанк', 'Белгородсоцбанк',
  'Братский АНКБ', 'ББР Банк', 'Выборг-банк', 'ВТБ', 'ВБ банк', 'ВЛАДБИЗНЕСБАНК', 'Витабанк',
  'Восточный Экспресс Банк', 'Газпромбанк', 'Газэнергобанк', 'ГОРБАНК', 'ГУТА-БАНК', 'ГАЗБАНК',
  'Дальневосточный банк', 'ЕАТПБанк', 'Енисейский объединенный банк', 'Земский банк',
  'КБ Гефест', 'КБ ЕНИСЕЙ', 'КБ Калуга', 'КБ Канский', 'КБ Кетовский', 'КБ Кубанский универсальный',
  'Кузбассхимбанк', 'КБ Курган', 'КБ Новопокровский', 'КБ РостФинанс', 'КБ Солидарность',
  'КБ Солид Банк', 'КБ Тальменка-банк', 'КБ Хлынов', 'КБ ЭНЕРГОТРАНСБАНК', 'КАБ Викинг',
  'КИБ ЕВРОАЛЬЯНС', 'Креди Агриколь КИБ', 'Кредит Европа Банк', 'Кредит Урал Банк', 'Крона-Банк',
  'Кубань Кредит', 'Кубаньторгбанк', 'Кузнецкбизнесбанк', 'МКБ', 'МБСП', 'МДМ Банк',
  'МИнБанк', 'Модульбанк', 'Московский Кредитный Банк', 'МТС Банк', 'НБД-Банк', 'НОКССБАНК',
  'Норвик Банк', 'Озон банк', 'ОТП Банк', 'ПСБ', 'Первомайский', 'Первый Дортрансбанк', 'Примсоцбанк',
  'Примтеркомбанк', 'Платежный Центр', 'Почта Банк', 'ПраймФинанс', 'Промсвязьбанк', 'Промэнергобанк',
  'Райффайзенбанк', 'Ренессанс Кредит', 'РЕАЛИСТ БАНК', 'Росбанк', 'Росгосстрах Банк',
  'Росевробанк', 'Россельхозбанк', 'Роял Кредит Банк', 'Русский Стандарт', 'Русфинанс Банк',
  'РУСБС', 'Сбербанк', 'Связь-Банк', 'Севзапинвестпромбанк', 'СИБСОЦБАНК', 'Совкомбанк',
  'Спб Банк', 'СЭБ Банк', 'Солид Банк', 'Сбербанк России', 'САММИТ БАНК',
  'Т-Банк (Тинькофф)', 'Тинькофф', 'ТелеПорт Банк', 'Тольяттихимбанк', 'Траст',
  'Уралсиб', 'ФИА-БАНК', 'ФОРУС Банк', 'Хоум Кредит', 'ЮГ-Инвестбанк', 'ЮниКредит Банк',
  'банк Элита', 'комбанк Арзамас', 'Комбанк Химик', 'ПАО АКБ Балтика', 'ПАО АКБ Приморье',
  'ПАО ИДЕЯ Банк', 'ПАО КБ ЕвроситиБанк', 'ПАО СКБ Приморья Примсоцбанк', 'ПАО ФИНСТАР БАНК',
  'Другой',
];
const LIMIT_TIERS = [
  { range: '100 - 999 ₽', value: '100-999', minDeposit: 5000 },
  { range: '1 000 - 4 999 ₽', value: '1000-4999', minDeposit: 10000 },
  { range: '5 000 - 19 999 ₽', value: '5000-19999', minDeposit: 30000 },
  { range: '20 000 - 300 000 ₽', value: '20000-300000', minDeposit: 50000 },
];

const norm = (s) => (s || '').replace(/\s/g, '').replace(/\D/g, '');

export default function Devices({ stats, payoutRequests = [], getAuthHeaders, onTabChange, onDeviceAdded }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDeviceId, setEditDeviceId] = useState(null);
  const [form, setForm] = useState({ type: 'card_ru', requisites: '', bank: '', limitRange: '', maxTurnoverPerDay: '', maxTurnoverTotal: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalStep, setModalStep] = useState(0);
  const [bankSearch, setBankSearch] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [deleteDeviceId, setDeleteDeviceId] = useState(null);

  const insuranceDeposit = stats?.insuranceDeposit ?? 0;
  const hasInsuranceDeposit = insuranceDeposit >= 5000;
  const availableLimits = LIMIT_TIERS.filter(t => insuranceDeposit >= t.minDeposit);

  const fetchDevices = async () => {
    if (!getAuthHeaders) return;
    try {
      const res = await fetch(`${API}/api/merchant-devices`, { headers: getAuthHeaders() });
      if (res.ok) setDevices(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, [getAuthHeaders]);

  // Открыть модалку при переходе с главной (кнопка «Добавить»)
  useEffect(() => {
    if (sessionStorage.getItem('openDevicesAddModal') === '1') {
      sessionStorage.removeItem('openDevicesAddModal');
      openModal();
    }
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/merchant-devices`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setDevices(prev => [...prev, data]);
      setShowModal(false);
      setEditDeviceId(null);
      setForm({ type: 'card_ru', requisites: '', bank: '', limitRange: '', maxTurnoverPerDay: '', maxTurnoverTotal: '' });
      setModalStep(0);
      setBankSearch('');
      onDeviceAdded?.();
    } catch (err) {
      setError(err.message || 'Ошибка добавления');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOnline = async (device) => {
    const nextOnline = !(device.online !== false);
    try {
      const res = await fetch(`${API}/api/merchant-devices/${device.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: nextOnline }),
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(prev => prev.map(d => d.id === device.id ? data : d));
        onDeviceAdded?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/api/merchant-devices/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setDevices(prev => prev.filter(d => d.id !== id));
        onDeviceAdded?.();
        setDeleteDeviceId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editDeviceId) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/merchant-devices/${editDeviceId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setDevices(prev => prev.map(d => d.id === editDeviceId ? data : d));
      setShowModal(false);
      setEditDeviceId(null);
      setForm({ type: 'card_ru', requisites: '', bank: '', limitRange: '', maxTurnoverPerDay: '', maxTurnoverTotal: '' });
      setModalStep(0);
      setBankSearch('');
      onDeviceAdded?.();
    } catch (err) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (device) => {
    setEditDeviceId(device.id);
    setForm({
      type: device.type || 'card_ru',
      requisites: device.requisites || '',
      bank: device.bank || '',
      limitRange: device.limitRange || availableLimits[0]?.value || '',
      maxTurnoverPerDay: device.maxTurnoverPerDay ?? '',
      maxTurnoverTotal: device.maxTurnoverTotal ?? '',
    });
    setError('');
    setModalStep(0);
    setBankSearch('');
    setBankDropdownOpen(false);
    setShowModal(true);
  };

  const openModal = () => {
    setForm({
      type: 'card_ru',
      requisites: '',
      bank: '',
      limitRange: availableLimits[0]?.value || '',
      maxTurnoverPerDay: '',
      maxTurnoverTotal: '',
    });
    setError('');
    setEditDeviceId(null);
    setModalStep(0);
    setBankSearch('');
    setBankDropdownOpen(false);
    setShowModal(true);
  };

  const filteredBanks = bankSearch.trim()
    ? RUSSIAN_BANKS.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase()))
    : RUSSIAN_BANKS;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.5rem' }}>
        Устройства
      </h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Добавляйте реквизиты карты или СБП для приёма выплат. Лимиты зависят от страхового депозита.
      </p>

      {!hasInsuranceDeposit && (
        <div style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          color: 'var(--error)',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
        }}>
          Для добавления устройств требуется страховой депозит от 5 000 ₽. Текущий: {insuranceDeposit.toLocaleString()} ₽
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={openModal}
          disabled={!hasInsuranceDeposit}
          style={{
            padding: '0.75rem 1.5rem',
            background: hasInsuranceDeposit ? 'var(--accent)' : 'var(--bg-card-hover)',
            color: hasInsuranceDeposit ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            cursor: hasInsuranceDeposit ? 'pointer' : 'not-allowed',
            fontSize: '0.95rem',
          }}
        >
          + Добавить
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Загрузка...</div>
      ) : devices.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-light)',
        }}>
          Нет устройств. Добавьте карту или СБП для приёма выплат.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {devices.map((d) => (
            <div
              key={d.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>
                  {TYPE_LABELS[d.type] || d.type}
                  {(() => {
                    const deviceReqs = norm(d.requisites);
                    const usedTotal = (payoutRequests || []).filter((r) => r.status === 'completed' && norm(r.requisites) === deviceReqs).reduce((s, r) => s + (r.amount || 0), 0);
                    const maxDay = Number(d.maxTurnoverPerDay) || 0;
                    const maxTotal = Number(d.maxTurnoverTotal) || 0;
                    const limit = maxTotal > 0 ? maxTotal : (maxDay > 0 ? maxDay : 300000);
                    const used = usedTotal;
                    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                    return (
                      <span style={{ marginLeft: '0.5rem', fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {used.toLocaleString()} / {limit.toLocaleString()} ₽ ({pct}%)
                      </span>
                    );
                  })()}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {d.requisites}
                </span>
                {d.bank && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Банк: {d.bank}
                    <span style={{ marginLeft: '0.5rem', fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      — Лимит: {LIMIT_TIERS.find(t => t.value === d.limitRange)?.range || d.limitRange}
                    </span>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  onClick={() => handleToggleOnline(d)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.9rem',
                    background: d.online === false ? 'rgba(220, 38, 38, 0.15)' : 'var(--bg-card-hover)',
                    border: `1px solid ${d.online === false ? 'var(--error)' : 'var(--border-light)'}`,
                    borderRadius: '10px',
                    color: d.online === false ? 'var(--error)' : 'var(--text)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: '32px',
                    height: '18px',
                    background: d.online === false ? 'var(--error)' : 'var(--positive)',
                    borderRadius: '999px',
                    position: 'relative',
                    flexShrink: 0,
                  }}>
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: d.online === false ? '2px' : '16px',
                      width: '14px',
                      height: '14px',
                      background: '#fff',
                      borderRadius: '50%',
                      transition: 'left 0.2s',
                    }} />
                  </span>
                  {d.online === false ? 'Офлайн' : 'Онлайн'}
                </button>
                <button
                  onClick={() => openEditModal(d)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Редактировать
                </button>
                <button
                  onClick={() => setDeleteDeviceId(d.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'transparent',
                    border: '1px solid var(--error)',
                    color: 'var(--error)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка добавления */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem',
          }}
          onClick={() => !submitting && setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '420px',
              width: '100%',
              border: '1px solid var(--border-light)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
              {editDeviceId ? 'Редактировать устройство' : 'Добавить устройство'}
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Шаг {modalStep + 1} из 3
            </div>

            {modalStep === 0 && (
              <form onSubmit={(e) => { e.preventDefault(); if (form.requisites.trim() && form.bank && form.limitRange) setModalStep(1); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Тип</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem' }}
                  >
                    <option value="card_ru">Банковская карта</option>
                    <option value="sbp">СБП</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {form.type === 'sbp' ? 'Номер телефона (СБП)' : 'Номер карты'}
                  </label>
                  <input
                    type="text"
                    value={form.requisites}
                    onChange={(e) => setForm(f => ({ ...f, requisites: e.target.value }))}
                    placeholder={form.type === 'sbp' ? '+7 900 123 45 67' : '1234 5678 9012 3456'}
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Банк</label>
                  <input
                    type="text"
                    value={bankDropdownOpen ? bankSearch : form.bank}
                    onChange={(e) => {
                      setBankSearch(e.target.value);
                      setBankDropdownOpen(true);
                    }}
                    onFocus={() => { setBankSearch(form.bank); setBankDropdownOpen(true); }}
                    onBlur={() => setTimeout(() => setBankDropdownOpen(false), 150)}
                    placeholder=""
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem' }}
                  />
                  {bankDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '2px', maxHeight: '180px', overflowY: 'auto',
                      background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}>
                      {filteredBanks.length ? filteredBanks.map((b) => (
                        <div
                          key={b}
                          onClick={() => { setForm(f => ({ ...f, bank: b })); setBankSearch(b); setBankDropdownOpen(false); }}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text)', borderBottom: '1px solid var(--border-light)' }}
                        >
                          {b}
                        </div>
                      )) : (
                        <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ничего не найдено</div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Принятие платежей по
                  </label>
                  <select
                    value={form.limitRange}
                    onChange={(e) => setForm(f => ({ ...f, limitRange: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem' }}
                  >
                    {availableLimits.map((t) => (
                      <option key={t.value} value={t.value}>{t.range}</option>
                    ))}
                  </select>
                </div>
                {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Отмена</button>
                  <button type="submit" disabled={!form.requisites.trim() || !form.bank || !form.limitRange} style={{ flex: 1, padding: '0.75rem', background: (!form.requisites.trim() || !form.bank || !form.limitRange) ? 'var(--bg-card-hover)' : 'var(--accent)', color: (!form.requisites.trim() || !form.bank || !form.limitRange) ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: (!form.requisites.trim() || !form.bank || !form.limitRange) ? 'not-allowed' : 'pointer' }}>Далее</button>
                </div>
              </form>
            )}

            {modalStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text)' }}>
                  Вы выбрали основным банк <strong>{form.bank || '—'}</strong> для платежей при переводе
                </div>
                {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setModalStep(0)} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>Назад</button>
                  <button type="button" onClick={() => setModalStep(2)} style={{ flex: 1, padding: '0.75rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Далее</button>
                </div>
              </div>
            )}

            {modalStep === 2 && (
              <form onSubmit={(e) => { e.preventDefault(); editDeviceId ? handleEdit(e) : handleAdd(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Максимальный оборот за день (₽)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.maxTurnoverPerDay}
                    onChange={(e) => setForm(f => ({ ...f, maxTurnoverPerDay: e.target.value.replace(/\D/g, '') }))}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Максимальный оборот за всё время (₽)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.maxTurnoverTotal}
                    onChange={(e) => setForm(f => ({ ...f, maxTurnoverTotal: e.target.value.replace(/\D/g, '') }))}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem' }}
                  />
                </div>
                {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button type="button" onClick={() => setModalStep(1)} disabled={submitting} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text)', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>Назад</button>
                  <button type="submit" disabled={submitting} style={{ flex: 1, padding: '0.75rem', background: submitting ? 'var(--bg-card-hover)' : 'var(--accent)', color: submitting ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? (editDeviceId ? 'Сохранение...' : 'Добавление...') : (editDeviceId ? 'Сохранить' : 'Добавить')}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Модалка подтверждения удаления */}
      {deleteDeviceId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
            padding: '1rem',
          }}
          onClick={() => setDeleteDeviceId(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%',
              border: '1px solid var(--border-light)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
              Удалить устройство?
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Устройство будет удалено безвозвратно.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteDeviceId(null)}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  color: 'var(--text)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteDeviceId)}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'var(--error)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
