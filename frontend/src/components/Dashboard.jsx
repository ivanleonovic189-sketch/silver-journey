import { useState, useEffect } from 'react';
import TelegramIcon from './TelegramIcon';
import { WalletIcon, DealsIcon, AppealsIcon, LockIcon, PlusIcon, InfoIcon } from './Icons';

export default function Dashboard({
  user,
  stats,
  transactions,
  merchants,
  paymentMethods,
  payoutRequests = [],
  onLogout,
  onTabChange,
  onWalletClick,
  usdtRate,
}) {
  const [chartPeriod, setChartPeriod] = useState('day'); // 'day', 'week', 'month', or 'all'
  const [showPeriodSelect, setShowPeriodSelect] = useState(false);
  const [dealsPeriod, setDealsPeriod] = useState('all');
  const [payoutsPeriod, setPayoutsPeriod] = useState('all');
  const [appealsPeriod, setAppealsPeriod] = useState('all');
  const [showDealsSelect, setShowDealsSelect] = useState(false);
  const [showPayoutsSelect, setShowPayoutsSelect] = useState(false);
  const [showAppealsSelect, setShowAppealsSelect] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [lockTooltip, setLockTooltip] = useState(null); // { text, x, y }
  const [infoModal, setInfoModal] = useState(null); // { title, text }
  
  const INFO_DEFINITIONS = {
    deals: { title: 'Сделки', text: 'Количество успешно завершенных P2P-транзакций. Показывает общее число оплаченных ордеров.' },
    appeals: { title: 'Апелляции', text: 'Количество оспоренных или неуспешных транзакций, требующих проверки. Включает отмененные сделки и случаи, когда покупатель инициировал спор.' },
    payouts: { title: 'Выплаты', text: 'Общая сумма выведенных средств с баланса. Отображает все успешно обработанные выводы за весь период.' },
    conversion: { title: 'Конверсия по устройствам', text: 'Процент успешно оплаченных сделок по каждому способу приема. Показывает эффективность работы платежных методов в P2P.' },
    chat: { title: 'Рабочий чат', text: 'Telegram-чат для связи с операторами. Здесь можно задать вопросы, получить поддержку по сделкам. Операторы будут пинговать вас по апелляциям.' },
    curator: { title: 'Ваш куратор', text: 'Назначенный куратор предоставляет реферальную ссылку, мануалы по работе с системой и персональную поддержку. Куратор помогает новым мерчантам разобраться в P2P-операциях.' },
    rate: { title: 'Процентная ставка', text: 'Комиссия в зависимости от суммы сделки. Чем выше объем, тем ниже ставка. Текущая ставка определяется размером страхового депозита.' },
  };

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

      // День = 7 дней, Неделя = 7 дней, Месяц = 30 дней, Все время = 30 дней
      const daysToShow = chartPeriod === 'day' || chartPeriod === 'week' ? 7 : 30;
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

          const timeFmt = chartPeriod === 'day' || chartPeriod === 'week'
            ? date.toLocaleDateString('ru', { weekday: 'short', day: '2-digit' })
            : date.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' });
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
  }, [transactions, stats, chartPeriod, user]);

  // Закрываем dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPeriodSelect && !event.target.closest('[data-period-select]')) setShowPeriodSelect(false);
      if (showDealsSelect && !event.target.closest('[data-period-select="deals"]')) setShowDealsSelect(false);
      if (showPayoutsSelect && !event.target.closest('[data-period-select="payouts"]')) setShowPayoutsSelect(false);
      if (showAppealsSelect && !event.target.closest('[data-period-select="appeals"]')) setShowAppealsSelect(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPeriodSelect, showDealsSelect, showPayoutsSelect, showAppealsSelect]);

  const maxAmount = Math.max(...chartData.map((d) => d.amount), 1);
  const chartHeight = 140;

  // Конверсия по методам оплаты
  const conversionData = paymentMethods.map((method) => {
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
  const hasInsuranceDeposit = insuranceDeposit >= 20000;
  // Проверяем наличие куратора (пока захардкожено, потом можно получать из API)
  const hasCurator = false; // Можно получать из user или stats

  // Процентные ставки
  const interestRates = [
    { percent: 14, range: '100 - 999 ₽', minDeposit: 5000 },
    { percent: 11, range: '1 000 - 4 999 ₽', minDeposit: 10000 },
    { percent: 9, range: '5 000 - 19 999 ₽', minDeposit: 30000 },
    { percent: 7.5, range: '20 000 - 300 000 ₽', minDeposit: 50000 },
  ];
  
  // Определяем доступную ставку на основе страхового депозита
  const getAvailableRate = (deposit) => {
    if (deposit >= 50000) return 3; // 7.5%
    if (deposit >= 30000) return 2; // 9%
    if (deposit >= 10000) return 1; // 11%
    if (deposit >= 5000) return 0; // 14%
    return -1; // Нет доступной ставки
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

  const totalDeals = transactions.filter((t) => t.status === 'completed' && filterByPeriod(t.createdAt, dealsPeriod)).length;
  const totalAppeals = transactions.filter((t) => t.status === 'failed' && filterByPeriod(t.createdAt, appealsPeriod)).length;
  // Выплаты = сумма завершённых заявок на выплату (P2P), отфильтрованных по периоду
  const totalPayouts = payoutRequests
    .filter((r) => r.status === 'completed' && filterByPeriod(r.completedAt || r.createdAt, payoutsPeriod))
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const PeriodSelect = ({ period, setPeriod, show, setShow, dataAttr }) => (
    <div style={{ position: 'relative' }} data-period-select={dataAttr}>
      <button
        onClick={() => setShow(!show)}
        style={{
          padding: '0.4rem 0.75rem',
          background: 'var(--bg-card-hover)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          color: 'var(--text)',
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontWeight: 500,
        }}
      >
        {period === 'day' ? 'День' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Все время'}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: show ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <path d="M6 9L1 4H11L6 9Z" fill="currentColor" />
        </svg>
      </button>
      {show && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.35rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', minWidth: '130px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
          {['day', 'week', 'month', 'all'].map((p) => (
            <button key={p} onClick={() => { setPeriod(p); setShow(false); }} style={{ width: '100%', padding: '0.5rem 0.75rem', background: period === p ? 'var(--bg-card-hover)' : 'transparent', border: 'none', color: period === p ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', fontWeight: period === p ? 600 : 400 }} onMouseEnter={(e) => { if (period !== p) e.currentTarget.style.background = 'var(--bg-card-hover)'; }} onMouseLeave={(e) => { if (period !== p) e.currentTarget.style.background = 'transparent'; }}>
              {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Все время'}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Верхняя статистика - карточки в ряд */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Сделки */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Сделки
              <button onClick={() => setInfoModal(INFO_DEFINITIONS.deals)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}><InfoIcon size={14} /></button>
            </div>
            <PeriodSelect period={dealsPeriod} setPeriod={setDealsPeriod} show={showDealsSelect} setShow={setShowDealsSelect} dataAttr="deals" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {totalDeals}
          </div>
        </div>

        {/* Выплаты */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Выплаты
              <button onClick={() => setInfoModal(INFO_DEFINITIONS.payouts)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}><InfoIcon size={14} /></button>
            </div>
            <PeriodSelect period={payoutsPeriod} setPeriod={setPayoutsPeriod} show={showPayoutsSelect} setShow={setShowPayoutsSelect} dataAttr="payouts" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {totalPayouts.toLocaleString()} ₽
          </div>
        </div>

        {/* Апелляции */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Апелляции
              <button onClick={() => setInfoModal(INFO_DEFINITIONS.appeals)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}><InfoIcon size={14} /></button>
            </div>
            <PeriodSelect period={appealsPeriod} setPeriod={setAppealsPeriod} show={showAppealsSelect} setShow={setShowAppealsSelect} dataAttr="appeals" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {totalAppeals}
          </div>
        </div>

      </div>

      {/* Основной контент - график и боковая панель */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Карточка "Ваш доход" с графиком */}
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '1.5rem 2rem 2.5rem 2rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
              <div>
                <h2
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Ваш доход{' '}
                  <span style={{ 
                    fontSize: '0.65rem', 
                    fontWeight: 400, 
                    textTransform: 'none',
                    color: 'var(--text-light)',
                  }}>
                    ({chartPeriod === 'day' ? 'ЗА СЕГОДНЯ' : chartPeriod === 'week' ? 'ЗА НЕДЕЛЮ' : chartPeriod === 'month' ? 'ЗА МЕСЯЦ' : 'ЗА ВСЕ ВРЕМЯ'})
                  </span>
                </h2>
                <div
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  {periodIncome.toLocaleString()} ₽
                </div>
              </div>
              <div style={{ 
                paddingLeft: '2rem',
                borderLeft: '1px solid var(--border-light)',
              }}>
                <h2
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Страховой депозит
                </h2>
                <div
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  {insuranceDeposit.toLocaleString()} ₽
                </div>
              </div>
              <div style={{ 
                paddingLeft: '2rem',
                borderLeft: '1px solid var(--border-light)',
              }}>
                <h2
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Рабочий депозит
                </h2>
                <div
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.2,
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
                <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600 }}>
                  Курс USDT: {usdtRate ? `${usdtRate.toFixed(2)}₽` : '—'}
                </span>
              </div>
              
              {/* Выпадающий список для всех периодов */}
              <div style={{ position: 'relative' }} data-period-select>
                <button
                  onClick={() => setShowPeriodSelect(!showPeriodSelect)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 500,
                  }}
                >
                  {chartPeriod === 'day' ? 'День' : chartPeriod === 'week' ? 'Неделя' : chartPeriod === 'month' ? 'Месяц' : 'Все время'}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showPeriodSelect ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M6 9L1 4H11L6 9Z" fill="currentColor" />
                  </svg>
                </button>
                
                {showPeriodSelect && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '0.5rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                      minWidth: '150px',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {['day', 'week', 'month', 'all'].map((period) => (
                      <button
                        key={period}
                        onClick={() => {
                          setChartPeriod(period);
                          setShowPeriodSelect(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: chartPeriod === period ? 'var(--bg-card-hover)' : 'transparent',
                          border: 'none',
                          borderRadius: '0',
                          color: chartPeriod === period ? 'var(--text)' : 'var(--text-muted)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                          fontWeight: chartPeriod === period ? 600 : 400,
                        }}
                        onMouseEnter={(e) => {
                          if (chartPeriod !== period) {
                            e.currentTarget.style.background = 'var(--bg-card-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (chartPeriod !== period) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {period === 'day' ? 'День' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Все время'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* График */}
          <div 
            style={{ position: 'relative', width: '100%', marginTop: '0.5rem' }}
          >
          <div 
            style={{ position: 'relative', height: `${chartHeight}px`, width: '100%', overflow: 'hidden' }}
            onMouseMove={(e) => {
              if (maxAmount === 0 || chartData.length === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
              const barCount = chartData.length;
              const barWidth = 100 / barCount * 0.6;
              const gap = 100 / barCount * 0.4;
              let closestIndex = -1;
              chartData.forEach((d, i) => {
                const x = (i / barCount) * 100 + gap / 2;
                if (mouseX >= x && mouseX <= x + barWidth) closestIndex = i;
              });
              if (closestIndex >= 0) {
                const barH = (chartData[closestIndex].amount / maxAmount) * chartHeight;
                setHoveredPoint(closestIndex);
                setTooltipPosition({
                  x: rect.left + (closestIndex / barCount + 0.5 / barCount) * rect.width,
                  y: rect.top + chartHeight - barH - 10,
                });
              } else {
                setHoveredPoint(null);
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {maxAmount === 0 ? (
              // Пустое состояние графика
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                gap: '0.5rem',
              }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
                  <path
                    d="M3 3V21H21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 16L12 11L16 15L21 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Нет данных за выбранный период</div>
              </div>
            ) : (
              <svg width="100%" height={chartHeight} viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chartBarGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
                  </linearGradient>
                </defs>
                {/* Сетка */}
                {[0.25, 0.5, 0.75].map((y) => (
                  <line
                    key={y}
                    x1={0}
                    y1={y * chartHeight}
                    x2={100}
                    y2={y * chartHeight}
                    stroke="var(--border)"
                    strokeWidth="0.5"
                    opacity="0.15"
                    strokeDasharray="2 2"
                  />
                ))}
                {/* Вертикальные столбцы — единая толщина, выровнены по подписям дат (space-between) */}
                {chartData.map((d, i) => {
                  const barCount = chartData.length;
                  const fixedBarWidth = 100 / 30 * 0.6;
                  const barWidth = fixedBarWidth;
                  const centerX = barCount > 1 ? (i / (barCount - 1)) * 100 : 50;
                  const x = Math.max(0, Math.min(100 - barWidth, centerX - barWidth / 2));
                  const barH = maxAmount > 0 ? (d.amount / maxAmount) * chartHeight : 0;
                  const y = chartHeight - barH;
                  const handleMouseEnter = (e) => {
                    setHoveredPoint(i);
                    const svgRect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                    const barCenterX = svgRect.left + (x / 100 + barWidth / 200) * svgRect.width;
                    const barTopY = svgRect.top + (y / chartHeight) * svgRect.height;
                    setTooltipPosition({
                      x: barCenterX,
                      y: barTopY - 8,
                    });
                  };
                  return (
                    <g key={i}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barH}
                        fill="url(#chartBarGradient)"
                        rx="4"
                        style={{ cursor: 'default', transition: 'opacity 0.2s' }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      <rect
                        x={x}
                        y={0}
                        width={barWidth}
                        height={chartHeight}
                        fill="transparent"
                        style={{ cursor: 'default' }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
            
            {/* Tooltip */}
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
                  padding: '1rem',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                  zIndex: 10000,
                  minWidth: '180px',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 500 }}>
                  {chartData[hoveredPoint].date || chartData[hoveredPoint].time}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Принято:</span>
                    <span style={{ color: 'var(--text)' }}>{(chartData[hoveredPoint].received || 0).toLocaleString()} ₽</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Выплачено:</span>
                    <span style={{ color: 'var(--text)' }}>{(chartData[hoveredPoint].paid || 0).toLocaleString()} ₽</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Заработано:</span>
                    <span style={{ color: chartData[hoveredPoint].earned >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {(chartData[hoveredPoint].earned || 0).toLocaleString()} ₽
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* Подписи осей */}
            {maxAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                }}
              >
                {chartData.map((d, i) => {
                  // Показываем не все даты, а только каждую N-ю, чтобы избежать повторений
                  const step = Math.max(1, Math.floor(chartData.length / 7)); // Максимум 7 подписей
                  const shouldShow = i === 0 || i === chartData.length - 1 || i % step === 0;
                  
                  // Проверяем, не повторяется ли дата с предыдущей
                  const prevTime = i > 0 ? chartData[i - 1].time : null;
                  const isDuplicate = d.time === prevTime;
                  
                  if (!shouldShow || isDuplicate) {
                    return <span key={i} style={{ visibility: 'hidden' }}>{d.time}</span>;
                  }
                  
                  return <span key={i} style={{ fontWeight: 500 }}>{d.time}</span>;
                })}
              </div>
            )}

            {/* Блок под графиком: Процентная ставка */}
            <div style={{ 
              marginTop: '1.5rem',
            }}>
              <div style={{ 
                fontSize: '0.7rem', 
                color: 'var(--text-muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                Процентная ставка
                <button onClick={() => setInfoModal(INFO_DEFINITIONS.rate)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}><InfoIcon size={14} /></button>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '1rem',
                width: '100%',
              }}>
                {interestRates.map((rate, idx) => {
                  const isAvailable = availableRateIndex >= idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--bg-card-hover)',
                        borderRadius: '10px',
                        padding: '1rem 1.25rem',
                        border: isAvailable ? '1px solid var(--success)' : '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        transition: 'all 0.2s',
                        width: '100%',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isAvailable ? 'var(--success)' : 'var(--border)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isAvailable ? 'var(--success)' : 'var(--border-light)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 700,
                        color: isAvailable ? 'var(--success)' : 'var(--text)',
                        lineHeight: 1,
                      }}>
                        {rate.percent}%
                      </div>
                      <div style={{ 
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                      }}>
                        {rate.range}
                      </div>
                      {isAvailable && idx === availableRateIndex && (
                        <div style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                          fontSize: '0.65rem',
                          color: 'var(--success)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}>
                          Доступно
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Боковая панель */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

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
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: '1.25rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              Конверсия по устройствам
              <button onClick={() => setInfoModal(INFO_DEFINITIONS.conversion)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}><InfoIcon size={14} /></button>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {conversionData.length > 0 ? (
                conversionData.map((item, idx) => (
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
                    <span style={{ color: 'var(--text)' }}>
                      {item.name} {item.bank}
                    </span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{item.conversion}%</span>
                  </div>
                ))
              ) : (
                <div style={{ position: 'relative', width: '100%' }}>
                  {!hasInsuranceDeposit && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '10px',
                        zIndex: 5,
                        pointerEvents: 'auto',
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setLockTooltip({ text: 'Чтобы добавить устройство, у вас должен быть страховой депозит от 20 000 ₽', x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseMove={(e) => {
                        if (lockTooltip) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setLockTooltip(prev => prev ? { ...prev, x: rect.left + rect.width / 2, y: rect.top } : null);
                        }
                      }}
                      onMouseLeave={() => setLockTooltip(null)}
                    />
                  )}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1rem',
                    width: '100%',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    color: hasInsuranceDeposit ? 'var(--text)' : 'var(--text-muted)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: hasInsuranceDeposit ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    opacity: hasInsuranceDeposit ? 1 : 0.5,
                    pointerEvents: hasInsuranceDeposit ? 'auto' : 'none',
                  }}
                  disabled={!hasInsuranceDeposit}
                  onMouseEnter={(e) => {
                    if (hasInsuranceDeposit) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setLockTooltip({ text: 'Чтобы добавить устройство, у вас должен быть страховой депозит от 20 000 ₽', x: rect.left + rect.width / 2, y: rect.top });
                    }
                  }}
                  onMouseMove={(e) => {
                    if (!hasInsuranceDeposit && lockTooltip) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setLockTooltip(prev => prev ? { ...prev, x: rect.left + rect.width / 2, y: rect.top } : null);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (hasInsuranceDeposit) {
                      e.currentTarget.style.borderColor = 'var(--border-light)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                    setLockTooltip(null);
                  }}
                >
                  {!hasInsuranceDeposit && <LockIcon size={18} color="var(--text-muted)" />}
                  <PlusIcon size={18} color={hasInsuranceDeposit ? 'var(--accent)' : 'var(--text-muted)'} />
                  <span>Добавить</span>
                </button>
                </div>
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
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: '1.25rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              Рабочий чат
              <TelegramIcon size={16} color="var(--text-muted)" />
              <button onClick={() => setInfoModal(INFO_DEFINITIONS.chat)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)', marginLeft: '0.2rem' }}><InfoIcon size={14} /></button>
            </h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '1.5rem',
                background: 'var(--bg-card-hover)',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                cursor: isChatUnlocked ? 'pointer' : 'default',
                transition: 'all 0.2s',
                filter: isChatUnlocked ? 'none' : 'blur(2px)',
                opacity: isChatUnlocked ? 1 : 0.6,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (isChatUnlocked) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
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
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
                setLockTooltip(null);
              }}
            >
              <TelegramIcon size={24} color="var(--accent)" />
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
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginBottom: '1.25rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              Ваш куратор
              <button onClick={() => setInfoModal(INFO_DEFINITIONS.curator)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}><InfoIcon size={14} /></button>
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

      {/* Модалка с определением */}
      {infoModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setInfoModal(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '1.5rem 2rem',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1rem' }}>
              {infoModal.title}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {infoModal.text}
            </div>
            <button
              onClick={() => setInfoModal(null)}
              style={{
                marginTop: '1.25rem',
                padding: '0.6rem 1.25rem',
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-light)',
                borderRadius: '10px',
                color: 'var(--text)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
