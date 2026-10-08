// Table of buys and sells, newest first. transactions: [{ at, ticker, name, type, quantity, price, amount, realisedPnl }]
function History({ transactions, money, signedMoney, showStock = true }) {
  if (!transactions.length) {
    return <p className="muted">Nothing yet. Use Buy or Sell on a holding and it is recorded here with its date and time.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            {showStock && <th>Stock</th>}
            <th>Type</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th className="num">Amount</th>
            <th className="num">Realised P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, i) => {
            const when = new Date(t.at)
            return (
              <tr key={i}>
                <td>{when.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td>{when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                {showStock && (
                  <td>
                    <strong>{t.ticker}</strong>
                    <div className="hint">{t.name}</div>
                  </td>
                )}
                <td>
                  <span className={`chip ${t.type.toLowerCase()}`}>{t.type === 'BUY' ? 'BOUGHT' : 'SOLD'}</span>
                </td>
                <td className="num">{t.quantity}</td>
                <td className="num">{money(t.price)}</td>
                <td className="num">{money(t.amount)}</td>
                <td className={`num ${t.realisedPnl == null ? '' : t.realisedPnl < 0 ? 'bad' : 'good'}`}>{t.realisedPnl == null ? '—' : signedMoney(t.realisedPnl)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default History
