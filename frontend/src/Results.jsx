import AllocationPie from './AllocationPie.jsx'

const DECISION_LABEL = { ATTENTION_NEEDED: 'ATTENTION NEEDED', NO_ACTION_NEEDED: 'NO ACTION NEEDED' }

function Metric({ label, value, note }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {note && <div className="hint">{note}</div>}
    </div>
  )
}

function Results({ result, money }) {
  const { decision, explanation, agents, cautions, suggestions, metrics } = result
  const { risk, market, rebalance } = agents
  const attention = decision === 'ATTENTION_NEEDED'

  return (
    <>
      <section className={`card decision ${attention ? 'attention' : 'clear'}`}>
        <div className="label">Final council verdict</div>
        <div className="verdict">{DECISION_LABEL[decision]}</div>
        <p>{explanation.text}</p>
        <p className="muted">
          Portfolio value {money(result.totalValue)} · explanation written by{' '}
          {explanation.source === 'llm' ? `the LLM (${explanation.model})` : 'fixed rules'}
        </p>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Current allocation</h2>
          <AllocationPie items={rebalance.drifts} dataKey="currentPercent" />
        </div>
        <div className="card">
          <h2>Suggested target allocation</h2>
          <AllocationPie items={rebalance.drifts} dataKey="suggestedPercent" />
          <p className="hint">Set by the Risk Agent: no stock above {risk.details.maxPerStock}% for your profile.</p>
        </div>
      </section>

      <section>
        <div className="card">
          <h2>Final cautions ({cautions.length})</h2>
          {cautions.length === 0 ? (
            <p className="muted">The Council raised no cautions.</p>
          ) : (
            <ul className="plain cautions">
              {cautions.map((c, i) => (
                <li key={i} className={c.severity}>
                  {c.message}
                  <div className="hint">{c.agent}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Suggestions: what to sell and buy</h2>
        {suggestions.length === 0 ? (
          <p className="muted">No changes suggested. Your holdings are in line with your suggested mix.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Suggestion</th>
                  <th className="num">Shares</th>
                  <th className="num">Price</th>
                  <th className="num">Amount</th>
                  <th>Why</th>
                  <th className="num">Share after</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((t) => (
                  <tr key={t.ticker}>
                    <td>
                      <strong>{t.ticker}</strong>
                    </td>
                    <td>
                      <span className={`chip ${t.action.toLowerCase()}`}>{t.action}</span>
                    </td>
                    <td className="num">{t.shares}</td>
                    <td className="num">{money(t.price)}</td>
                    <td className="num">{money(t.amount)}</td>
                    <td>{t.reason}</td>
                    <td className="num">{t.afterPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Suggestions are for you to review. Nothing is bought or sold by this app, costs and tax are not counted, and this is not financial advice.</p>
      </section>

      <details className="analysis">
        <summary>View agent analysis</summary>
        <section className="grid three">
          <div className="card">
            <h2>Market Agent</h2>
            <ul className="plain">
              {market.signals.map((s) => (
                <li key={s.ticker}>
                  <strong>{s.ticker}</strong> {money(s.price)} <span className={`chip ${s.trend}`}>{s.trend}</span>
                  <div className="hint">
                    {s.change30d > 0 ? '+' : ''}
                    {s.change30d}% in 30 days · volatility {s.volatility}% · {s.source} data
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>Risk Agent</h2>
            <div className="big">
              {risk.riskScore}/100 <span className={`chip risk-${risk.riskLevel.toLowerCase()}`}>{risk.riskLevel}</span>
            </div>
            <ul className="plain">
              <li>Tolerance ({risk.details.riskTolerance}): {risk.factors.tolerance}/25</li>
              <li>Horizon ({risk.details.horizonYears}y): {risk.factors.horizon}/25</li>
              <li>
                Concentration ({risk.details.largestHolding.ticker} {risk.details.largestHolding.percent}%): {risk.factors.concentration}/25
              </li>
              <li>
                Diversification ({risk.details.holdingCount} stocks, {risk.details.sectorCount} sectors): {risk.factors.diversification}/25
              </li>
            </ul>
            <p className="hint">Limit per stock for your profile: {risk.details.maxPerStock}%</p>
          </div>

          <div className="card">
            <h2>Rebalance Agent</h2>
            <div className="big">{rebalance.maxDrift} pts max drift</div>
            <p className="hint">{rebalance.reasoning}</p>
            <ul className="plain">
              {rebalance.drifts.map((d) => (
                <li key={d.ticker}>
                  <strong>{d.ticker}</strong> {d.currentPercent}% <span className={`chip ${d.status.replace(' ', '-')}`}>{d.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </details>

      <section className="card">
        <h2>Evaluation metrics</h2>
        <div className="metrics">
          <Metric label="Decision time" value={`${metrics.decisionTimeMs} ms`} note={`Prices + agents + council · explanation took ${metrics.explanationTimeMs} ms`} />
          <Metric label="Drift before" value={`${metrics.maxDriftBefore} pts`} note={`Average ${metrics.avgDriftBefore} pts`} />
          <Metric label="Drift after" value={`${metrics.maxDriftAfter} pts`} note={`If the suggestions are followed · average ${metrics.avgDriftAfter} pts`} />
          <Metric label="Drift reduction" value={`${metrics.driftReductionPercent}%`} note="Share of average drift the suggestions remove" />
        </div>
      </section>
    </>
  )
}

export default Results
