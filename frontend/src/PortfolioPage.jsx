import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AllocationPie from './AllocationPie.jsx'
import { TOOLTIP_STYLE } from './chartTheme.js'
import History from './History.jsx'

const greeting = () => {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

const tone = (n) => (n > 0 ? 'good' : n < 0 ? 'bad' : '')
const percent = (n) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`

// Portfolio page: what the user owns, valued with live prices
function PortfolioPage({ marketSwitch, money, signedMoney, portfolio, rows, totals, updateRow, addRow, removeRow, loadStored, save, trade, goTo }) {
  const { notice, result, transactions } = portfolio
  const empty = rows.length === 0
  const [ticket, setTicket] = useState(null) // the open buy/sell form: { ticker, type, quantity, price, error }

  const openTicket = (r, type) => setTicket({ ticker: r.ticker, type, quantity: '', price: r.quote ? String(r.quote.price) : '', error: '' })

  const confirmTicket = async () => {
    const error = await trade(ticket.ticker, ticket.type, Number(ticket.quantity), Number(ticket.price))
    setTicket(error ? { ...ticket, error } : null)
  }

  const valued = rows.filter((r) => r.value > 0)
  const shares = valued.map((r) => ({ ticker: r.ticker, percent: Math.round((r.value / totals.value) * 1000) / 10 }))
  const costVsValue = valued.filter((r) => r.invested > 0).map((r) => ({ ticker: r.ticker, Invested: Math.round(r.invested), 'Current value': Math.round(r.value) }))

  return (
    <>
      <header className="hero hero-row">
        <div>
          <p className="muted">{greeting()}</p>
          <div className="big-value">{money(totals.value)}</div>
          <p className="muted">
            Portfolio value
            {totals.value > 0 && (
              <span className={tone(totals.dayPnl)}>
                {' '}
                · {signedMoney(totals.dayPnl)} ({percent(totals.dayPercent)}) today
              </span>
            )}
          </p>
        </div>
        {marketSwitch}
      </header>

      <section className="tiles">
        <div className="tile">
          <div className="label">Invested</div>
          <div className="value">{totals.hasBuyPrices ? money(totals.invested) : '—'}</div>
        </div>
        <div className="tile">
          <div className="label">Today's P&amp;L</div>
          <div className={`value ${tone(totals.dayPnl)}`}>{totals.value > 0 ? signedMoney(totals.dayPnl) : '—'}</div>
        </div>
        <div className="tile">
          <div className="label">Total P&amp;L</div>
          <div className={`value ${tone(totals.totalPnl)}`}>{totals.hasBuyPrices ? signedMoney(totals.totalPnl) : '—'}</div>
        </div>
        <div className="tile">
          <div className="label">Risk</div>
          <div className="value">{result ? result.agents.risk.riskLevel : '—'}</div>
          {!result && <div className="hint">Run a check on the Rebalance page</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Your holdings ({totals.count})</h2>
          <div className="button-group">
            <button onClick={() => loadStored('sample')}>Load demo portfolio</button>
            <button onClick={() => loadStored('saved')}>Load saved</button>
            <button onClick={save} disabled={empty}>
              Save
            </button>
          </div>
        </div>
        {notice && <p className="notice">{notice}</p>}

        {empty ? (
          <div className="empty">
            <p>No holdings yet.</p>
            <p className="muted">Load the demo portfolio, find stocks on the Markets page, or add one by symbol.</p>
            <div className="button-group">
              <button className="primary" onClick={() => loadStored('sample')}>
                Load demo portfolio
              </button>
              <button onClick={() => goTo('markets')}>Search stocks</button>
              <button onClick={addRow}>+ Add by symbol</button>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Qty</th>
                  <th>Avg. price</th>
                  <th className="num">LTP</th>
                  <th className="num">Value</th>
                  <th className="num">Day</th>
                  <th className="num">Overall</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input type="text" className="symbol" placeholder="Symbol" value={portfolio.holdings[i].ticker} onChange={(e) => updateRow(i, 'ticker', e.target.value.toUpperCase())} />
                      {r.ticker && r.quote && <div className="hint">{r.quote.name}</div>}
                      {r.ticker && r.quote === null && <div className="hint bad">Stock not found</div>}
                    </td>
                    <td>
                      <input type="number" min="0" placeholder="0" value={r.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" min="0" placeholder="optional" value={r.buyPrice} onChange={(e) => updateRow(i, 'buyPrice', e.target.value)} />
                    </td>
                    <td className="num">{r.quote ? money(r.quote.price) : '—'}</td>
                    <td className="num">{r.value ? money(r.value) : '—'}</td>
                    <td className={`num ${r.quote ? tone(r.quote.changePercent) : ''}`}>{r.quote ? percent(r.quote.changePercent) : '—'}</td>
                    <td className={`num ${r.overallPercent == null ? '' : tone(r.overallPercent)}`}>
                      {r.overallPercent == null ? '—' : percent(r.overallPercent)}
                      {r.totalPnl != null && <div className="hint">{signedMoney(r.totalPnl)}</div>}
                    </td>
                    <td className="num actions">
                      <button className="mini buy" onClick={() => openTicket(r, 'BUY')} disabled={!r.quote}>
                        Buy
                      </button>
                      <button className="mini sell" onClick={() => openTicket(r, 'SELL')} disabled={!r.quote || !Number(r.quantity)}>
                        Sell
                      </button>
                      <button className="remove" onClick={() => removeRow(i)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ticket && (
          <div className="ticket">
            <strong>
              {ticket.type === 'BUY' ? 'Buy' : 'Sell'} {ticket.ticker}
            </strong>
            <label>
              Quantity
              <input type="number" min="1" autoFocus value={ticket.quantity} onChange={(e) => setTicket({ ...ticket, quantity: e.target.value, error: '' })} />
            </label>
            <label>
              Price
              <input type="number" min="0" value={ticket.price} onChange={(e) => setTicket({ ...ticket, price: e.target.value, error: '' })} />
            </label>
            <span className="muted">Total {money((Number(ticket.quantity) || 0) * (Number(ticket.price) || 0))}</span>
            <div className="button-group">
              <button className="primary" onClick={confirmTicket}>
                Record {ticket.type === 'BUY' ? 'buy' : 'sell'}
              </button>
              <button onClick={() => setTicket(null)}>Cancel</button>
            </div>
            {ticket.error && <p className="bad">{ticket.error}</p>}
            <p className="hint">Recorded with the current date and time, added to your history and saved. No real order is placed.</p>
          </div>
        )}

        {!empty && (
          <div className="footer-row">
            <div className="button-group">
              <button onClick={addRow}>+ Add by symbol</button>
              <button onClick={() => goTo('markets')}>Search stocks</button>
            </div>
            <button className="primary" onClick={() => goTo('rebalance')}>
              Check portfolio health
            </button>
          </div>
        )}
      </section>

      {valued.length > 0 && (
        <section className="grid two">
          <div className="card">
            <h2>Allocation by value</h2>
            <AllocationPie items={shares} dataKey="percent" />
          </div>
          <div className="card">
            <h2>Invested vs current value</h2>
            {costVsValue.length === 0 ? (
              <p className="muted">Enter average prices to compare what you paid with what it is worth now.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={costVsValue}>
                  <CartesianGrid stroke="#d0d7de" vertical={false} />
                  <XAxis dataKey="ticker" stroke="#656d76" fontSize={12} />
                  <YAxis stroke="#656d76" fontSize={12} tickFormatter={(v) => v.toLocaleString(undefined, { notation: 'compact' })} />
                  <Tooltip formatter={(v) => money(v)} cursor={{ fill: '#0000000a' }} contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="Invested" fill="#0969da" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="Current value" fill="#1b7c83" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <h2>History: bought and sold ({transactions.length})</h2>
        <History transactions={transactions} money={money} signedMoney={signedMoney} />
      </section>
    </>
  )
}

export default PortfolioPage
