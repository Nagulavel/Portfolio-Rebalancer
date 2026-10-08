import Results from './Results.jsx'

// Rebalance page: the investor's profile and the multi-agent health check
function RebalancePage({ marketSwitch, money, portfolio, totals, update, analyze, loading, goTo }) {
  const { riskTolerance, horizonYears, result, error } = portfolio

  return (
    <>
      <header className="hero hero-row">
        <div>
          <h1>Portfolio health</h1>
          <p className="muted">Three agents review your holdings, raise cautions and suggest what to sell and buy.</p>
        </div>
        {marketSwitch}
      </header>

      <section className="card">
        <div className="card-head">
          <h2>Your profile</h2>
          <span className="muted">
            {totals.count} stock{totals.count === 1 ? '' : 's'} · {money(totals.value)}
          </span>
        </div>
        <div className="profile">
          <label>
            Risk tolerance
            <div className="segmented">
              {['low', 'medium', 'high'].map((level) => (
                <button key={level} className={level === riskTolerance ? 'active' : ''} onClick={() => update({ riskTolerance: level })}>
                  {level}
                </button>
              ))}
            </div>
          </label>
          <label>
            Investment horizon (years)
            <input type="number" min="1" value={horizonYears} onChange={(e) => update({ horizonYears: e.target.value })} />
          </label>
        </div>
        <div className="footer-row">
          {totals.count === 0 ? <button onClick={() => goTo('portfolio')}>Add holdings first</button> : <span />}
          <button className="primary" onClick={analyze} disabled={loading || totals.count === 0}>
            {loading ? 'Agents are reviewing…' : 'Analyze portfolio'}
          </button>
        </div>
        {error && <p className="bad">{error}</p>}
      </section>

      {result && <Results result={result} money={money} />}
    </>
  )
}

export default RebalancePage
