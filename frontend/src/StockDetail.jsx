import { useEffect, useState } from 'react'
import axios from 'axios'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TOOLTIP_STYLE } from './chartTheme.js'
import History from './History.jsx'

const RANGES = ['5D', '1M', '6M', '1Y']

// Everything about one stock: live price, price-history chart, key figures and the user's own trades in it
function StockDetail({ market, ticker, money, signedMoney, owned, transactions, onAdd, onBack }) {
  const [range, setRange] = useState('1M')
  // Kept with the request it answers, so an old reply never shows under a new stock or range
  const [loaded, setLoaded] = useState(null) // { key, detail } | { key, error }
  const key = `${market}:${ticker}:${range}`

  useEffect(() => {
    let cancelled = false
    axios
      .get(`/api/market/${market}/stock/${encodeURIComponent(ticker)}`, { params: { range } })
      .then((res) => !cancelled && setLoaded({ key: `${market}:${ticker}:${range}`, detail: res.data }))
      .catch(() => !cancelled && setLoaded({ key: `${market}:${ticker}:${range}`, error: true }))
    return () => {
      cancelled = true
    }
  }, [market, ticker, range])

  // While a new range loads, keep showing the last data for this stock
  const current = loaded?.key === key ? loaded : null
  const detail = current?.detail || (loaded?.detail?.ticker === ticker && loaded.key.startsWith(`${market}:`) ? loaded.detail : null)
  const stale = detail && !current?.detail
  const mine = transactions.filter((t) => t.ticker === ticker)

  const num = (n, digits = 2) => (n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits }))
  const cash = (n) => (n == null ? '—' : money(n))
  const compact = (n) => (n == null ? '—' : n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 }))
  const tick = (iso) => {
    const d = new Date(iso)
    return range === '5D' ? d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: range === '1Y' ? '2-digit' : undefined })
  }

  if (current?.error && !detail) {
    return (
      <>
        <button className="back" onClick={onBack}>
          ← Back to markets
        </button>
        <p className="bad">Could not load {ticker}. Is the backend running?</p>
      </>
    )
  }
  if (!detail) {
    return (
      <>
        <button className="back" onClick={onBack}>
          ← Back to markets
        </button>
        <p className="muted">Loading {ticker}…</p>
      </>
    )
  }

  const { stats, history } = detail
  const first = history[0]?.close
  const last = history[history.length - 1]?.close
  const rangeChange = first ? (last / first - 1) * 100 : 0
  const up = rangeChange >= 0
  const dayMove = stats.previousClose != null ? detail.price - stats.previousClose : null

  return (
    <>
      <button className="back" onClick={onBack}>
        ← Back to markets
      </button>

      <header className="hero hero-row">
        <div>
          <h1>{detail.ticker}</h1>
          <p className="muted">
            {detail.name}
            {stats.exchange ? ` · ${stats.exchange}` : ''} · {detail.sector}
          </p>
          <div className="big-value">{money(detail.price)}</div>
          <p className={detail.changePercent < 0 ? 'bad' : 'good'}>
            {dayMove != null && `${signedMoney(dayMove)} `}({detail.changePercent > 0 ? '+' : ''}
            {detail.changePercent}%) today <span className={`chip ${detail.trend}`}>{detail.trend}</span>
          </p>
        </div>
        <button className="primary" onClick={() => onAdd(detail.ticker)} disabled={owned}>
          {owned ? 'In portfolio' : '+ Add to portfolio'}
        </button>
      </header>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Price history</h2>
            <p className={`hint ${up ? 'good' : 'bad'}`}>
              {stale ? 'Loading…' : `${up ? '+' : ''}${rangeChange.toFixed(2)}% over ${detail.range}`}
            </p>
          </div>
          <div className="segmented">
            {RANGES.map((r) => (
              <button key={r} className={r === range ? 'active' : ''} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        {history.length < 2 ? (
          <p className="muted">No price history is available for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={up ? '#34d399' : '#f87171'} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={up ? '#34d399' : '#f87171'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#263043" vertical={false} />
              <XAxis dataKey="time" tickFormatter={tick} stroke="#8b98ad" fontSize={12} minTickGap={50} />
              <YAxis domain={['auto', 'auto']} stroke="#8b98ad" fontSize={12} width={70} tickFormatter={(v) => num(v, 0)} />
              <Tooltip labelFormatter={(iso) => new Date(iso).toLocaleString()} formatter={(v) => [money(v), 'Close']} contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="close" stroke={up ? '#34d399' : '#f87171'} strokeWidth={2} fill="url(#price-fill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="card">
        <h2>Stock details</h2>
        <dl className="stats">
          {[
            ['Open', cash(stats.open)],
            ['Previous close', cash(stats.previousClose)],
            ['Day high', cash(stats.dayHigh)],
            ['Day low', cash(stats.dayLow)],
            ['52-week high', cash(stats.yearHigh)],
            ['52-week low', cash(stats.yearLow)],
            ['Volume', compact(stats.volume)],
            ['Market cap', stats.marketCap == null ? '—' : money(0).replace('0', '') + compact(stats.marketCap)],
            ['P/E ratio', num(stats.peRatio)],
            ['30-day change', `${detail.change30d > 0 ? '+' : ''}${detail.change30d}%`],
            ['Volatility (annualised)', `${detail.volatility}%`],
            ['Data', `${detail.source}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2>Your history in {detail.ticker} ({mine.length})</h2>
        <History transactions={mine} money={money} signedMoney={signedMoney} showStock={false} />
      </section>
    </>
  )
}

export default StockDetail
