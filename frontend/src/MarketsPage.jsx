import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import StockDetail from './StockDetail.jsx'

function StockCard({ stock, money, owned, onAdd, onView }) {
  return (
    <article className="stock">
      <div className="stock-head">
        <button className="stock-title" onClick={() => onView(stock.ticker)} title={`View ${stock.ticker} details`}>
          <span className="ticker">{stock.ticker}</span>
          <span className="hint">{stock.name}</span>
        </button>
        {stock.trend && <span className={`chip ${stock.trend}`}>{stock.trend}</span>}
      </div>
      {stock.price == null ? (
        <div className="hint">Loading price…</div>
      ) : (
        <>
          <div className="price">{money(stock.price)}</div>
          <div className={stock.changePercent < 0 ? 'bad' : 'good'}>
            {stock.changePercent > 0 ? '+' : ''}
            {stock.changePercent}% today
          </div>
          <dl>
            <div>
              <dt>30 days</dt>
              <dd className={stock.change30d < 0 ? 'bad' : 'good'}>
                {stock.change30d > 0 ? '+' : ''}
                {stock.change30d}%
              </dd>
            </div>
            <div>
              <dt>Sector</dt>
              <dd>{stock.sector}</dd>
            </div>
          </dl>
        </>
      )}
      <div className="stock-foot">
        <button onClick={() => onView(stock.ticker)}>View</button>
        <button onClick={() => onAdd(stock.ticker)} disabled={owned}>
          {owned ? 'In portfolio' : '+ Add to portfolio'}
        </button>
      </div>
    </article>
  )
}

// Markets page: stock search and live prices, both from the Market Agent
function MarketsPage({ market, marketSwitch, money, signedMoney, portfolio, rows, addStock }) {
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState(null) // { market, ticker } of the stock detail that is open
  // Everything fetched is stored with the market (and query) it belongs to,
  // so a slow reply never shows under the wrong market or search
  const [found, setFound] = useState(null) // { key, list }
  const [prices, setPrices] = useState({}) // "IN:TCS" -> stock data
  const [popular, setPopular] = useState({}) // market -> { list, at }
  const [failed, setFailed] = useState(false)

  const owned = rows.map((r) => r.ticker)
  const text = query.trim()
  const searchKey = `${market}:${text}`
  const results = text && found?.key === searchKey ? found.list : null

  // Search: names first, then live prices for the matches
  useEffect(() => {
    if (!text) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/market/${market}/search`, { params: { q: text } })
        if (cancelled) return
        setFound({ key: `${market}:${text}`, list: res.data })
        if (!res.data.length) return
        const quotes = await axios.get(`/api/market/${market}/quotes`, { params: { tickers: res.data.map((s) => s.ticker).join(',') } })
        if (cancelled) return
        const priced = Object.fromEntries(Object.values(quotes.data.stocks).map((s) => [`${market}:${s.ticker}`, s]))
        setPrices((all) => ({ ...all, ...priced }))
      } catch {
        if (!cancelled) setFound({ key: `${market}:${text}`, list: [] })
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [market, text])

  const loadPopular = useCallback(() => {
    return axios
      .get(`/api/market/${market}/popular`)
      .then((res) => {
        setFailed(false)
        setPopular((all) => ({ ...all, [market]: { list: res.data, at: new Date() } }))
      })
      .catch(() => setFailed(true))
  }, [market])

  useEffect(() => {
    loadPopular()
    const timer = setInterval(loadPopular, 60000)
    return () => clearInterval(timer)
  }, [loadPopular])

  const live = popular[market]

  // A stock is open: show its detail page instead of the lists
  if (viewing?.market === market) {
    return (
      <StockDetail
        market={market}
        ticker={viewing.ticker}
        money={money}
        signedMoney={signedMoney}
        owned={owned.includes(viewing.ticker)}
        transactions={portfolio.transactions}
        onAdd={addStock}
        onBack={() => setViewing(null)}
      />
    )
  }
  const view = (ticker) => {
    setViewing({ market, ticker })
    window.scrollTo(0, 0)
  }

  return (
    <>
      <header className="hero hero-row">
        <div>
          <h1>Markets</h1>
          <p className="muted">Search any stock and see live prices from the Market Agent.</p>
        </div>
        {marketSwitch}
      </header>

      <section className="card">
        <input
          type="search"
          className="search"
          placeholder={market === 'IN' ? 'Search by company or symbol, e.g. Tata' : 'Search by company or symbol, e.g. Apple'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search stocks"
        />
        {text && !results && <p className="muted">Searching…</p>}
        {results && results.length === 0 && <p className="muted">No {market === 'IN' ? 'NSE' : 'US'} stocks match “{text}”.</p>}
        {results && results.length > 0 && (
          <div className="stock-grid">
            {results.map((s) => (
              <StockCard key={s.ticker} stock={{ ...s, ...prices[`${market}:${s.ticker}`] }} money={money} owned={owned.includes(s.ticker)} onAdd={addStock} onView={view} />
            ))}
          </div>
        )}
      </section>

      <div className="card-head">
        <div>
          <h2>Popular stocks</h2>
          <p className="muted">
            {live ? `Updated ${live.at.toLocaleTimeString()}. ` : ''}Prices are cached for up to 15 minutes.
          </p>
        </div>
        <button onClick={loadPopular}>Refresh</button>
      </div>

      {failed && <p className="bad">Could not load market data. Is the backend running?</p>}
      {!live && !failed && <p className="muted">Loading live prices…</p>}
      {live && (
        <section className="stock-grid">
          {live.list.map((s) => (
            <StockCard key={s.ticker} stock={s} money={money} owned={owned.includes(s.ticker)} onAdd={addStock} onView={view} />
          ))}
        </section>
      )}
    </>
  )
}

export default MarketsPage
