import { useEffect, useState } from 'react'
import axios from 'axios'
import PortfolioPage from './PortfolioPage.jsx'
import MarketsPage from './MarketsPage.jsx'
import RebalancePage from './RebalancePage.jsx'
import './App.css'

const MARKETS = {
  IN: { label: 'India', currency: '₹', locale: 'en-IN' },
  US: { label: 'US', currency: '$', locale: 'en-US' },
}

const PAGES = { portfolio: 'Portfolio', markets: 'Markets', rebalance: 'Rebalance' }

const emptyRow = () => ({ ticker: '', quantity: '', buyPrice: '' })
const emptyPortfolio = () => ({ holdings: [], transactions: [], riskTolerance: 'medium', horizonYears: '5', result: null, error: '', notice: '' })

// A portfolio as stored in the database -> the text values the form uses
const toForm = (stored) => ({
  riskTolerance: stored.riskTolerance,
  horizonYears: String(stored.horizonYears),
  holdings: stored.holdings.map((h) => ({
    ticker: h.ticker,
    quantity: String(h.quantity),
    buyPrice: h.buyPrice == null ? '' : String(h.buyPrice),
  })),
  transactions: stored.transactions || [],
})

function App() {
  const [backendDown, setBackendDown] = useState(false)
  const [page, setPage] = useState('portfolio')
  const [market, setMarket] = useState('IN')
  // One portfolio per market, so switching market never loses what was typed
  const [portfolios, setPortfolios] = useState({ IN: emptyPortfolio(), US: emptyPortfolio() })
  const [quotes, setQuotes] = useState({ IN: {}, US: {} }) // ticker -> stock data, or null if not found
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    axios.get('/api/health').catch(() => setBackendDown(true))
  }, [])

  const { currency, locale } = MARKETS[market]
  const portfolio = portfolios[market]
  const { holdings, transactions, riskTolerance, horizonYears } = portfolio
  const update = (changes) => setPortfolios((all) => ({ ...all, [market]: { ...all[market], ...changes } }))
  const money = (n) => `${currency}${n.toLocaleString(locale, { maximumFractionDigits: 2 })}`
  const signedMoney = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`

  const tickerList = holdings.map((h) => h.ticker.trim()).filter(Boolean).join(',')

  // Market Agent: live price for every holding, shortly after typing stops
  useEffect(() => {
    if (!tickerList) return
    let cancelled = false
    const timer = setTimeout(() => {
      axios
        .get(`/api/market/${market}/quotes`, { params: { tickers: tickerList } })
        .then((res) => {
          if (cancelled) return
          const found = { ...res.data.stocks }
          res.data.notFound.forEach((t) => (found[t] = null))
          setQuotes((all) => ({ ...all, [market]: { ...all[market], ...found } }))
        })
        .catch(() => {})
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [market, tickerList])

  // Each holding with its live numbers
  const rows = holdings.map((h) => {
    const ticker = h.ticker.trim()
    const quote = quotes[market][ticker]
    const qty = Number(h.quantity) || 0
    const buy = Number(h.buyPrice) || 0
    const value = quote ? quote.price * qty : 0
    return {
      ...h,
      ticker,
      quote,
      value,
      invested: buy * qty,
      // Today's move in money: what the holding is worth now minus what it was worth at yesterday's close
      dayPnl: quote ? value - value / (1 + quote.changePercent / 100) : 0,
      totalPnl: quote && qty && buy ? (quote.price - buy) * qty : null,
      overallPercent: quote && buy ? (quote.price / buy - 1) * 100 : null,
    }
  })
  const sum = (key) => rows.reduce((s, r) => s + (r[key] || 0), 0)
  const value = sum('value')
  const dayPnl = sum('dayPnl')
  const totals = {
    value,
    dayPnl,
    dayPercent: value - dayPnl > 0 ? (dayPnl / (value - dayPnl)) * 100 : 0,
    invested: sum('invested'),
    totalPnl: sum('totalPnl'),
    hasBuyPrices: rows.some((r) => r.totalPnl != null),
    count: rows.filter((r) => r.ticker).length,
  }

  const updateRow = (i, field, val) => update({ holdings: holdings.map((h, idx) => (idx === i ? { ...h, [field]: val } : h)) })
  const addRow = () => update({ holdings: [...holdings, emptyRow()] })
  const removeRow = (i) => update({ holdings: holdings.filter((_, idx) => idx !== i) })

  // From the Markets page: put a stock into the portfolio
  const addStock = (ticker) => {
    if (holdings.some((h) => h.ticker.trim() === ticker)) return
    update({ holdings: [...holdings.filter((h) => h.ticker.trim()), { ...emptyRow(), ticker }], notice: `${ticker} added. Enter a quantity.` })
  }

  // Demo and saved portfolios both come from the database
  const loadStored = async (kind) => {
    try {
      const res = await axios.get(`/api/portfolio/${market}/${kind}`)
      if (!res.data.portfolio) return update({ notice: 'Nothing saved yet for this market.' })
      const where = res.data.storedIn === 'mongodb' ? 'MongoDB' : 'memory (MongoDB is not connected)'
      update({ ...toForm(res.data.portfolio), result: null, error: '', notice: `Loaded ${kind === 'sample' ? 'demo' : 'saved'} portfolio from ${where}.` })
    } catch {
      update({ notice: 'Could not reach the backend.' })
    }
  }

  // Writes the portfolio (holdings + history) to the database
  const save = async (next = {}) => {
    try {
      const res = await axios.put(`/api/portfolio/${market}/saved`, { riskTolerance, horizonYears: Number(horizonYears), holdings, transactions, ...next })
      return res.data.storedIn === 'mongodb' ? 'MongoDB' : 'memory only (MongoDB is not connected)'
    } catch {
      return null
    }
  }

  const saveNow = async () => {
    const where = await save()
    update({ notice: where ? `Portfolio saved to ${where}.` : 'Could not save. Is the backend running?' })
  }

  // Records a buy or sell at this moment, updates the holding and saves both.
  // Returns an error message, or nothing when it worked.
  const trade = async (ticker, type, quantity, price) => {
    const index = holdings.findIndex((h) => h.ticker.trim() === ticker)
    const held = Number(holdings[index].quantity) || 0
    const avg = Number(holdings[index].buyPrice) || 0
    if (!(quantity > 0) || !(price > 0)) return 'Enter a quantity and a price above 0.'
    if (type === 'SELL' && quantity > held) return `You only hold ${held} ${ticker}.`

    const newQty = type === 'BUY' ? held + quantity : held - quantity
    // Buying changes the average price; selling leaves it as it was
    const newAvg = type === 'BUY' ? (held * (avg || price) + quantity * price) / newQty : avg
    const entry = {
      at: new Date().toISOString(),
      ticker,
      name: quotes[market][ticker]?.name || ticker,
      type,
      quantity,
      price,
      amount: quantity * price,
      realisedPnl: type === 'SELL' && avg ? (price - avg) * quantity : null,
    }
    const next = {
      holdings:
        newQty === 0
          ? holdings.filter((_, i) => i !== index)
          : holdings.map((h, i) => (i === index ? { ...h, quantity: String(newQty), buyPrice: newAvg ? String(Math.round(newAvg * 100) / 100) : '' } : h)),
      transactions: [entry, ...transactions],
    }
    update({ ...next, result: null, notice: `${type === 'BUY' ? 'Bought' : 'Sold'} ${quantity} ${ticker} at ${money(price)}. Saving…` })
    const where = await save(next)
    update({ notice: `${type === 'BUY' ? 'Bought' : 'Sold'} ${quantity} ${ticker} at ${money(price)}. ${where ? `Saved to ${where}.` : 'Could not save to the database.'}` })
  }

  const analyze = async () => {
    const filled = holdings.filter((h) => h.ticker.trim())
    if (!filled.length) return update({ error: 'Your portfolio is empty. Add stocks on the Portfolio page first.', result: null })

    setLoading(true)
    update({ error: '' })
    try {
      const res = await axios.post('/api/council', {
        market,
        riskTolerance,
        horizonYears: Number(horizonYears),
        holdings: filled.map((h) => ({ ticker: h.ticker.trim(), quantity: Number(h.quantity) || 0 })),
      })
      update({ result: res.data, error: '' })
    } catch (err) {
      update({ result: null, error: err.response?.data?.error || 'Could not reach the backend.' })
    } finally {
      setLoading(false)
    }
  }

  const marketSwitch = (
    <div className="tabs" role="tablist">
      {Object.entries(MARKETS).map(([code, m]) => (
        <button key={code} role="tab" aria-selected={code === market} className={code === market ? 'active' : ''} onClick={() => setMarket(code)}>
          {m.label} {m.currency}
        </button>
      ))}
    </div>
  )

  const shared = { market, marketSwitch, money, signedMoney, portfolio, rows, totals, update, goTo: setPage }

  return (
    <>
      <nav className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="logo" aria-hidden="true" />
            ReBalance AI
          </div>
          <div className="nav">
            {Object.entries(PAGES).map(([key, label]) => (
              <button key={key} className={key === page ? 'active' : ''} onClick={() => setPage(key)}>
                {label}
              </button>
            ))}
          </div>
          {backendDown && <span className="status down">Backend not reachable</span>}
        </div>
      </nav>

      <main className="app">
        {page === 'portfolio' && <PortfolioPage {...shared} updateRow={updateRow} addRow={addRow} removeRow={removeRow} loadStored={loadStored} save={saveNow} trade={trade} />}
        {page === 'markets' && <MarketsPage {...shared} addStock={addStock} />}
        {page === 'rebalance' && <RebalancePage {...shared} analyze={analyze} loading={loading} />}
      </main>
    </>
  )
}

export default App
