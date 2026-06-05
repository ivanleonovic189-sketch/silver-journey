import { useState, useEffect } from 'react';
import TelegramIcon from './TelegramIcon';
import { LockIcon } from './Icons';

const TYPE_LABELS = { card_ru: 'Банковская карта', sbp: 'СБП' };

export default function Dashboard({
  user,
  stats,
  transactions,
  merchants,
  paymentMethods,
  merchantDevices = [],
  payoutRequests = [],
  onLogout,
  onTabChange,
  onWalletClick,
  usdtRate,
  onDeviceToggleOnline,
}) {
  const chartPeriod = 'day';
  const [totalIncome, setTotalIncome] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [lockTooltip, setLockTooltip] = useState(null); // { text, x, y }
  
  useEffect(() => {
    if (transactions && stats) {
      // Общий доход за всё время (для начального отображения)
      const received = transactions
        .filter((t) => t.type === 'deposit' && t.status === 'completed' && t.direction === 'in')
        .reduce((sum, t) => sum + t.amount, 0);
      const paid = transactions
        .filter((t) => t.type === 'withdraw' && t.status === 'completed' && t.direction === 'out')
        .reduce((sum, t) => sum + t.amount, 0);
      const payoutRewards = transactions
        .filter((t) => t.type === 'payout_reward' && t.status === 'completed')
        .reduce((sum, t) => sum + (t.commission ?? Math.round((t.baseAmount ?? t.amount) * 0.01)), 0);
      setTotalIncome(received - paid + payoutRewards);

      const now = new Date();
      const chartPoints = [];

      const daysToShow = 7;
      for (let i = daysToShow - 1; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);

          const dayDeposits = transactions.filter((t) => {
            const txTime = new Date(t.createdAt);
            return txTime >= dayStart && txTime <= dayEnd && t.type === 'deposit' && t.status === 'completed';
          });
          const dayWithdraws = transactions.filter((t) => {
            const txTime = new Date(t.createdAt);
            return txTime >= dayStart && txTime <= dayEnd && t.type === 'withdraw' && t.status === 'completed';
          });
          const dayPayoutRewards = transactions.filter((t) => {
            const txTime = new Date(t.createdAt);
            return txTime >= dayStart && txTime <= dayEnd && t.type === 'payout_reward' && t.status === 'completed';
          });

          const received = dayDeposits.filter((t) => t.direction === 'in').reduce((sum, t) => sum + t.amount, 0);
          const paid = dayDeposits.filter((t) => t.direction === 'out').reduce((sum, t) => sum + t.amount, 0)
            + dayWithdraws.reduce((sum, t) => sum + t.amount, 0);
          const payoutRewards = dayPayoutRewards.reduce((sum, t) => sum + (t.commission ?? Math.round((t.baseAmount ?? t.amount) * 0.01)), 0);
          const earned = received - paid + payoutRewards;

          const timeFmt = date.toLocaleDateString('ru', { weekday: 'short', day: '2-digit' });
          chartPoints.push({
            time: timeFmt,
            date: date.toISOString().split('T')[0],
            amount: earned,
            received,
            paid,
            earned,
          });
        }

      // Кумулятивная сумма: график идёт вверх
      let cumulative = 0;
      const chartPointsWithCumulative = chartPoints.map((p) => {
        cumulative += p.earned;
        return { ...p, amount: cumulative };
      });

      setChartData(chartPointsWithCumulative);
    }
  }, [transactions, stats, user]);

  const openDevicesAdd = () => {
    sessionStorage.setItem('openDevicesAddModal', '1');
    onTabChange?.('devices');
  };

  const addDeviceLockHint = 'Вам необходимо выполнить одно пополнение для разблокировки';

  const renderAddDeviceButton = (compact = false) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { if (hasDeposit) openDevicesAdd(); }}
      onKeyDown={(e) => { if (hasDeposit && e.key === 'Enter') openDevicesAdd(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '0.6rem' : '1rem',
        width: '100%',
        background: 'var(--bg-card-hover)',
        border: compact ? '1px dashed var(--border-light)' : '1px solid var(--border-light)',
        borderRadius: compact ? '8px' : '10px',
        color: 'var(--text)',
        fontSize: compact ? '0.8rem' : '0.875rem',
        fontWeight: 600,
        cursor: hasDeposit ? 'pointer' : 'default',
        filter: hasDeposit ? 'none' : 'blur(2px)',
        opacity: hasDeposit ? 1 : 0.6,
        transition: 'opacity 0.2s',
      }}
      onMouseEnter={(e) => {
        if (hasDeposit) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.opacity = '0.85';
        } else {
          const rect = e.currentTarget.getBoundingClientRect();
          setLockTooltip({ text: addDeviceLockHint, x: rect.left + rect.width / 2, y: rect.top });
        }
      }}
      onMouseMove={(e) => {
        if (!hasDeposit && lockTooltip) {
          const rect = e.currentTarget.getBoundingClientRect();
          setLockTooltip((prev) => (prev ? { ...prev, x: rect.left + rect.width / 2, y: rect.top } : null));
        }
      }}
      onMouseLeave={(e) => {
        if (hasDeposit) {
          e.currentTarget.style.borderColor = compact ? 'var(--border-light)' : 'var(--border-light)';
          e.currentTarget.style.opacity = '1';
        }
        setLockTooltip(null);
      }}
    >
      Добавить
    </div>
  );

  const maxAmount = Math.max(...chartData.map((d) => d.amount), 1);
  const maxEarned = Math.max(...chartData.map((d) => d.earned || 0), 1);
  const chartHeight = 140;

  const norm = (s) => (s || '').replace(/\s/g, '').replace(/\D/g, '');
  const last4 = (r) => (r || '').replace(/\D/g, '').slice(-4) || '****';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Конверсия: если есть наши устройства, показываем их; иначе по методам оплаты
  const conversionData = merchantDevices.length > 0
    ? merchantDevices.map((device) => {
        const methodTxs = transactions.filter((t) => t.paymentMethod === device.type);
        const completed = methodTxs.filter((t) => t.status === 'completed').length;
        const conversion = methodTxs.length > 0 ? Math.round((completed / methodTxs.length) * 100) : 0;
        const deviceReqs = norm(device.requisites);
        const usedToday = (payoutRequests || []).filter((r) => r.status === 'completed' && String(r.traderId) === String(user?.id) && norm(r.requisites) === deviceReqs && new Date(r.completedAt || r.createdAt) >= todayStart && new Date(r.completedAt || r.createdAt) <= todayEnd).reduce((s, r) => s + (r.amount || 0), 0);
        const usedTotal = (payoutRequests || []).filter((r) => r.status === 'completed' && String(r.traderId) === String(user?.id) && norm(r.requisites) === deviceReqs).reduce((s, r) => s + (r.amount || 0), 0);
        const maxDay = Number(device.maxTurnoverPerDay) || 0;
        const maxTotal = Number(device.maxTurnoverTotal) || 0;
        const limit = maxTotal > 0 ? maxTotal : (maxDay > 0 ? maxDay : 300000);
        const used = maxTotal > 0 ? usedTotal : (maxDay > 0 ? usedToday : usedTotal);
        const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        return {
          name: `${TYPE_LABELS[device.type] || device.type}${device.bank ? ` (${device.bank})` : ''} •••• ${last4(device.requisites)}`,
          conversion,
          used,
          limit,
          pct,
          device,
        };
      }).sort((a, b) => b.conversion - a.conversion)
    : paymentMethods.map((method) => {
        const methodTxs = transactions.filter((t) => t.paymentMethod === method.id);
        const completed = methodTxs.filter((t) => t.status === 'completed').length;
        const conversion = methodTxs.length > 0 ? Math.round((completed / methodTxs.length) * 100) : 0;
        return {
          name: method.name,
          conversion,
          bank: method.name.includes('СБП') ? 'СБП' : method.name.includes('карта') ? 'Банк' : 'Другое',
        };
      }).filter((d) => d.conversion > 0).sort((a, b) => b.conversion - a.conversion);

  // Страховой депозит = пополнения вручную (merchant_deposit). Рабочий = с выплат (payout_reward).
  const insuranceDeposit = stats?.insuranceDeposit ?? transactions.filter((t) => t.type === 'merchant_deposit' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const workingDeposit = stats?.workingDeposit ?? transactions.filter((t) => t.type === 'payout_reward' && t.status === 'completed').reduce((s, t) => s + (t.commission ?? Math.round((t.baseAmount ?? t.amount) * 0.01)), 0);
  // Проверяем, было ли хотя бы одно пополнение (транзакция типа deposit со статусом completed)
  const hasDeposit = transactions.some(t => t.type === 'deposit' && t.status === 'completed' && t.direction === 'in');
  const isChatUnlocked = hasDeposit;
  // Проверяем страховой депозит для разблокировки функций
  const hasInsuranceDeposit = insuranceDeposit >= 10000;
  // Проверяем наличие куратора (пока захардкожено, потом можно получать из API)
  const hasCurator = false; // Можно получать из user или stats

  // Процентные ставки
  const interestRates = [
    { percent: 16,   range: 'Моб. коммерция до 999 ₽',       minDeposit: 2000 },
    { percent: 14,   range: 'СБП / С2С 100 - 999 ₽',          minDeposit: 2000 },
    { percent: 12,   range: 'СБП / С2С 1 000 - 4 999 ₽',      minDeposit: 7000 },
    { percent: 10.5, range: 'СБП / С2С 5 000 - 19 999 ₽',     minDeposit: 15000 },
    { percent: 9,    range: 'СБП / С2С 20 000 - 300 000 ₽',   minDeposit: 30000 },
  ];

  // Определяем доступную ставку на основе страхового депозита
  const getAvailableRate = (deposit) => {
    if (deposit >= 30000) return 4; // 9%
    if (deposit >= 15000) return 3; // 10.5%
    if (deposit >= 7000)  return 2; // 12%
    if (deposit >= 2000)  return 1; // 14% / 16%
    return -1;
  };
  
  const availableRateIndex = getAvailableRate(insuranceDeposit);

  const filterByPeriod = (dateStr, period) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (period === 'day') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      return date >= today && date < tomorrow;
    }
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    }
    if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= monthAgo;
    }
    return true; // all
  };

  // Ваш доход за выбранный период (для графика)
  const periodIncome = (() => {
    const received = transactions
      .filter((t) => t.type === 'deposit' && t.status === 'completed' && t.direction === 'in' && filterByPeriod(t.createdAt, chartPeriod))
      .reduce((sum, t) => sum + t.amount, 0);
    const paid = transactions
      .filter((t) => t.type === 'withdraw' && t.status === 'completed' && t.direction === 'out' && filterByPeriod(t.createdAt, chartPeriod))
      .reduce((sum, t) => sum + t.amount, 0);
    const payoutRewards = transactions
      .filter((t) => t.type === 'payout_reward' && t.status === 'completed' && filterByPeriod(t.createdAt, chartPeriod))
      .reduce((sum, t) => sum + (t.commission ?? Math.round((t.baseAmount ?? t.amount) * 0.01)), 0);
    return received - paid + payoutRewards;
  })();

  const totalDeals = transactions.filter((t) => t.status === 'completed').length;
  const totalAppeals = transactions.filter((t) => t.status === 'failed').length;
  const totalPayouts = payoutRequests
    .filter((r) => r.status === 'completed' && String(r.traderId) === String(user?.id))
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 5 ? 'Доброй ночи' : greetingHour < 12 ? 'Доброе утро' : greetingHour < 18 ? 'Добрый день' : 'Добрый вечер';
  const firstName = (user?.name || '').trim().split(/\s+/)[0];

  const statCardStyle = {
    background: 'var(--bg-card)',
    borderRadius: '14px',
    padding: '1.4rem 1.5rem',
    border: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    transition: 'border-color 0.2s, background 0.2s',
  };
  const eyebrowStyle = {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  };
  const onCardEnter = (e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card-hover)'; };
  const onCardLeave = (e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-card)'; };
  const clickableCardStyle = { cursor: 'pointer' };

  return (
    <div className="ep-page">
      {/* Приветствие */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Вот как идут дела с вашими платежами сегодня
        </p>
      </div>

      {/* Верхняя статистика - карточки в ряд */}
      <div className="ep-dash-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Сделки */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onTabChange?.('deals')}
          onKeyDown={(e) => e.key === 'Enter' && onTabChange?.('deals')}
          style={{ ...statCardStyle, ...clickableCardStyle }}
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
        >
          <div style={eyebrowStyle}>Сделки</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {totalDeals}
          </div>
        </div>

        {/* Выплаты */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onTabChange?.('payouts')}
          onKeyDown={(e) => e.key === 'Enter' && onTabChange?.('payouts')}
          style={{ ...statCardStyle, ...clickableCardStyle }}
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
        >
          <div style={eyebrowStyle}>Выплаты</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {totalPayouts.toLocaleString()} ₽
          </div>
        </div>

        {/* Апелляции */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onTabChange?.('appeals')}
          onKeyDown={(e) => e.key === 'Enter' && onTabChange?.('appeals')}
          style={{ ...statCardStyle, ...clickableCardStyle }}
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
        >
          <div style={eyebrowStyle}>Апелляции</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {totalAppeals}
          </div>
        </div>

      </div>

      {/* Основной контент - левая карточка и правая панель с графиком */}
      <div className="ep-dash-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
        {/* Левая карточка: доходы без графика */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '1.5rem 2rem 1.75rem 2rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '1.4rem', alignItems: 'flex-start' }}>
              <div>
                <h2
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.45rem',
                    fontWeight: 500,
                  }}
                >
                  Ваш доход{' '}
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    color: 'var(--text-light)',
                  }}>
                    за сегодня
                  </span>
                </h2>
                <div
                  style={{
                    fontSize: '1.7rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {periodIncome.toLocaleString()} ₽
                </div>
              </div>
              <div style={{
                paddingLeft: '1.4rem',
                borderLeft: '1px solid var(--border-light)',
              }}>
                <h2
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.45rem',
                    fontWeight: 500,
                  }}
                >
                  Страховой депозит
                </h2>
                <div
                  style={{
                    fontSize: '1.7rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {insuranceDeposit.toLocaleString()} ₽
                </div>
              </div>
              <div style={{
                paddingLeft: '1.4rem',
                borderLeft: '1px solid var(--border-light)',
              }}>
                <h2
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.45rem',
                    fontWeight: 500,
                  }}
                >
                  Рабочий депозит
                </h2>
                <div
                  style={{
                    fontSize: '1.7rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {workingDeposit.toLocaleString()} ₽
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {/* Курс USDT */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'var(--bg-card-hover)',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
              }}>
                <span style={{
                  fontSize: '0.9rem',
                  color: 'var(--text)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  lineHeight: 1,
                }}>
                  <span>Курс</span>
                  <img
                    src="/usdt.webp"
                    alt="USDT"
                    style={{
                      width: '22px',
                      height: '22px',
                      flexShrink: 0,
                      display: 'block',
                      objectFit: 'contain',
                    }}
                  />
                  <span>{usdtRate ? `${usdtRate.toFixed(2)}₽` : 'нет'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Процентная ставка, ступенчатый список */}
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ 
                fontSize: '0.9rem',
                color: 'var(--text)',
                fontWeight: 600,
                marginBottom: '1rem',
              }}>
                Ставки трейдера
              </div>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                background: 'var(--bg-card-hover)',
                borderRadius: '12px',
                padding: '0.5rem',
                border: '1px solid var(--border-light)',
              }}>
                {interestRates.map((rate, idx) => {
                  const isAvailable = availableRateIndex >= idx;
                  const isCurrent = idx === availableRateIndex;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.7rem 0.9rem',
                        borderRadius: '10px',
                        background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                        border: isCurrent ? '1px solid var(--accent)' : '1px solid transparent',
                        opacity: isAvailable ? 1 : 0.5,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (isAvailable && !isCurrent) e.currentTarget.style.background = 'var(--bg-card)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: isCurrent ? 'var(--accent)' : 'var(--text)',
                        minWidth: '3rem',
                        letterSpacing: '-0.01em',
                      }}>
                        {rate.percent}%
                      </span>
                      <span style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        flex: 1,
                      }}>
                        {rate.range}
                      </span>
                      {isCurrent ? (
                        <span style={{
                          fontSize: '0.7rem',
                          color: 'var(--accent)',
                          fontWeight: 600,
                          padding: '0.2rem 0.6rem',
                          background: 'var(--accent-soft)',
                          borderRadius: '999px',
                        }}>
                          Ваша ставка
                        </span>
                      ) : !isAvailable ? (
                        <LockIcon size={14} color="var(--text-light)" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        {/* Правая колонка: график + боковая панель */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* График дохода справа, горизонтальные полоски */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600, margin: '0 0 1rem' }}>
              Доход по дням
            </h3>
            {maxAmount === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Нет данных</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {chartData.slice(-(chartData.length <= 7 ? 7 : 10)).reverse().map((d, i) => {
                  const dataIdx = chartData.length - 1 - i;
                  const pct = (d.earned || 0) > 0 && maxEarned > 0 ? ((d.earned || 0) / maxEarned) * 100 : 0;
                  return (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                      onMouseEnter={(e) => {
                        setHoveredPoint(dataIdx);
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 4 });
                      }}
                      onMouseLeave={() => setHoveredPoint(null)}
                      data-chart-row={i}
                    >
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: '42px', fontWeight: 500 }}>{d.time}</span>
                      <div style={{ flex: 1, height: '20px', background: 'var(--bg-card-hover)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'var(--accent)',
                            borderRadius: '6px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {hoveredPoint !== null && chartData[hoveredPoint] && (
              <div
                style={{
                  position: 'fixed',
                  left: `${tooltipPosition.x}px`,
                  top: `${tooltipPosition.y}px`,
                  transform: 'translate(-50%, -100%)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  zIndex: 10000,
                  minWidth: '200px',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>{chartData[hoveredPoint].date || chartData[hoveredPoint].time}</div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>Принято: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{(chartData[hoveredPoint].received || 0).toLocaleString()} ₽</span></div>
                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>Выводов: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{(chartData[hoveredPoint].paid || 0).toLocaleString()} ₽</span></div>
                <div style={{ fontSize: '0.85rem' }}>Заработано: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{(chartData[hoveredPoint].earned || 0).toLocaleString()} ₽</span></div>
              </div>
            )}
          </div>

          {/* Конверсия по устройствам */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
            }}
          >
            <h3
              style={{
                marginBottom: '1.25rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--text)',
              }}
            >
              Конверсия по устройствам
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {conversionData.length > 0 ? (
                <>
                  {conversionData.map((item, idx) => {
                    const isOffline = item.device?.online === false;
                    return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.875rem',
                        padding: '0.75rem',
                        background: 'var(--bg-card-hover)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-light)',
                      }}
                    >
<div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ color: 'var(--text)' }}>
                        {item.name}
                        {item.limit != null && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {item.used?.toLocaleString()} / {item.limit?.toLocaleString()} ₽ ({item.pct}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {item.device && onDeviceToggleOnline && (
                        <button
                          onClick={() => onDeviceToggleOnline(item.device.id, !(item.device.online !== false))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.25rem 0.4rem',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            color: isOffline ? 'var(--error)' : 'var(--text-muted)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{
                            width: '24px',
                            height: '14px',
                            background: isOffline ? 'var(--error)' : 'var(--accent)',
                            borderRadius: '999px',
                            position: 'relative',
                            flexShrink: 0,
                          }}>
                            <span style={{
                              position: 'absolute',
                              top: '1px',
                              left: isOffline ? '1px' : '11px',
                              width: '12px',
                              height: '12px',
                              background: '#fff',
                              borderRadius: '50%',
                              transition: 'left 0.2s',
                            }} />
                          </span>
                          {isOffline ? 'Офлайн' : 'Онлайн'}
                        </button>
                      )}
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.conversion}%</span>
                    </div>
                    </div>
                  );})}
                  {merchantDevices.length > 0 && renderAddDeviceButton(true)}
                </>
              ) : (
                renderAddDeviceButton(false)
              )}
            </div>
          </div>

          {/* Рабочий чат */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
              position: 'relative',
            }}
          >
            <h3
              style={{
                marginBottom: '1rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              Рабочий чат
              <TelegramIcon size={24} />
            </h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: isChatUnlocked ? 'pointer' : 'default',
                transition: 'opacity 0.2s',
                filter: isChatUnlocked ? 'none' : 'blur(2px)',
                opacity: isChatUnlocked ? 1 : 0.6,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (isChatUnlocked) {
                  e.currentTarget.style.opacity = '0.85';
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setLockTooltip({ text: 'Вам необходимо выполнить одно пополнение для разблокировки', x: rect.left + rect.width / 2, y: rect.top });
                }
              }}
              onMouseMove={(e) => {
                if (!isChatUnlocked && lockTooltip) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setLockTooltip(prev => prev ? { ...prev, x: rect.left + rect.width / 2, y: rect.top } : null);
                }
              }}
              onMouseLeave={(e) => {
                if (isChatUnlocked) {
                  e.currentTarget.style.opacity = '1';
                }
                setLockTooltip(null);
              }}
            >
              <TelegramIcon size={36} />
              <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.95rem' }}>
                Открыть чат
              </span>
            </div>
          </div>

          {/* Ваш куратор */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '1.5rem',
              border: '1px solid var(--border-light)',
              position: 'relative',
            }}
          >
            <h3
              style={{
                marginBottom: '1.25rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--text)',
              }}
            >
              Ваш куратор
            </h3>
            
            {/* Реферальная ссылка */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-card-hover)',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                marginBottom: '0.75rem',
                filter: hasCurator ? 'none' : 'blur(2px)',
                opacity: hasCurator ? 1 : 0.6,
                position: 'relative',
                cursor: hasCurator ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (!hasCurator) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setLockTooltip({ text: 'Вам необходимо иметь куратора', x: rect.left + rect.width / 2, y: rect.top });
                }
              }}
              onMouseMove={(e) => {
                if (!hasCurator && lockTooltip) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setLockTooltip(prev => prev ? { ...prev, x: rect.left + rect.width / 2, y: rect.top } : null);
                }
              }}
              onMouseLeave={() => setLockTooltip(null)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>
                  Реферальная ссылка
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {hasCurator ? 'Скопировать ссылку' : 'У вас пока нет куратора'}
                </span>
              </div>
            </div>

            {/* Мануалы */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-card-hover)',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                filter: hasCurator ? 'none' : 'blur(2px)',
                opacity: hasCurator ? 1 : 0.6,
                position: 'relative',
                cursor: hasCurator ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (!hasCurator) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setLockTooltip({ text: 'Вам необходимо иметь куратора', x: rect.left + rect.width / 2, y: rect.top });
                }
              }}
              onMouseMove={(e) => {
                if (!hasCurator && lockTooltip) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setLockTooltip(prev => prev ? { ...prev, x: rect.left + rect.width / 2, y: rect.top } : null);
                }
              }}
              onMouseLeave={() => setLockTooltip(null)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem' }}>
                  Мануалы
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {hasCurator ? 'Открыть мануалы' : 'У вас пока нет куратора'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Кастомный тултип для заблокированных блоков */}
      {lockTooltip && (
        <div
          style={{
            position: 'fixed',
            left: lockTooltip.x,
            top: lockTooltip.y - 8,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '0.75rem 1.25rem',
            fontSize: '0.8rem',
            color: 'var(--text)',
            fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            zIndex: 10000,
            pointerEvents: 'none',
            maxWidth: '260px',
            textAlign: 'center',
          }}
        >
          {lockTooltip.text}
        </div>
      )}

    </div>
  );
}
