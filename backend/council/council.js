// Council — combines the three agents into one final verdict. Rule-based and deterministic.
// It gives cautions and buy/sell suggestions for the user to review; nothing is ever traded.
//
// runCouncil({ market, riskTolerance, horizonYears, positions, totalValue })
//
// Rules:
//   1. Decision is "ATTENTION_NEEDED" when the Rebalance Agent finds a stock past the
//      drift threshold OR the Risk Agent rates the portfolio High. Otherwise "NO_ACTION_NEEDED".
//   2. Every agent contributes cautions, merged into one final list. Market cautions (falling, very volatile or
//      sharply moving stocks) are information only — they never change the decision.

const riskAgent = require("../agents/riskAgent");
const rebalanceAgent = require("../agents/rebalanceAgent");
const { explainDecision } = require("./explainer");

const HIGH_VOLATILITY = 40; // annualised %
const BIG_DAILY_MOVE = 3; // % in one day

const round = (n) => Math.round(n * 100) / 100;

function marketCautions(positions) {
    const cautions = [];
    for (const p of positions) {
        if (p.trend === "bearish") {
            cautions.push({ ticker: p.ticker, severity: "medium", message: `${p.ticker} has fallen ${Math.abs(p.change30d)}% over the last 30 days.` });
        }
        if (p.volatility > HIGH_VOLATILITY) {
            cautions.push({ ticker: p.ticker, severity: "high", message: `${p.ticker} is highly volatile (${p.volatility}% annualised).` });
        }
        if (Math.abs(p.changePercent) >= BIG_DAILY_MOVE) {
            cautions.push({
                ticker: p.ticker,
                severity: "medium",
                message: `${p.ticker} moved ${p.changePercent > 0 ? "+" : ""}${p.changePercent}% today.`
            });
        }
        if (p.source === "mock") {
            cautions.push({ ticker: p.ticker, severity: "high", message: `Live data for ${p.ticker} is unavailable — placeholder numbers were used.` });
        }
    }
    return cautions;
}

async function runCouncil({ market, riskTolerance, horizonYears, positions, totalValue }) {
    const risk = riskAgent({ riskTolerance, horizonYears, positions });
    const rebalance = rebalanceAgent({ positions, totalValue, targetAllocation: risk.targetAllocation });

    const marketView = {
        agent: "Market Agent",
        signals: positions.map((p) => ({
            ticker: p.ticker,
            name: p.name,
            price: p.price,
            changePercent: p.changePercent,
            change30d: p.change30d,
            volatility: p.volatility,
            trend: p.trend,
            source: p.source
        })),
        cautions: marketCautions(positions)
    };

    const decision = rebalance.needsAttention || risk.riskLevel === "High" ? "ATTENTION_NEEDED" : "NO_ACTION_NEEDED";

    // Final cautions: every agent's cautions in one list, most serious first.
    // When the Risk Agent already flags a stock as over its limit, the Rebalance
    // Agent's "overweight" caution for the same stock says the same thing, so it is dropped.
    const tag = (agent) => (c) => ({ agent: agent.agent, ...c });
    const overLimit = new Set(risk.cautions.map((c) => c.ticker).filter(Boolean));
    const overweight = new Set(rebalance.drifts.filter((d) => d.status === "overweight").map((d) => d.ticker));
    const cautions = [
        ...risk.cautions.map(tag(risk)),
        ...rebalance.cautions.filter((c) => !(overLimit.has(c.ticker) && overweight.has(c.ticker))).map(tag(rebalance)),
        ...marketView.cautions.map(tag(marketView))
    ].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));

    // Evaluation metrics. Drift = distance from the suggested share, in percentage points.
    // "After" is where the portfolio would stand if the suggestions were followed.
    const avg = (list) => list.reduce((s, n) => s + n, 0) / list.length;
    const before = rebalance.drifts.map((d) => Math.abs(d.currentPercent - d.suggestedPercent));
    const after = rebalance.drifts.map((d) => Math.abs(d.projectedPercent - d.suggestedPercent));
    const metrics = {
        maxDriftBefore: round(Math.max(...before)),
        maxDriftAfter: round(Math.max(...after)),
        avgDriftBefore: round(avg(before)),
        avgDriftAfter: round(avg(after)),
        driftReductionPercent: avg(before) > 0 ? round((1 - avg(after) / avg(before)) * 100) : 0,
        cautionCount: cautions.length
    };

    const result = {
        market,
        currency: positions[0].currency,
        totalValue: round(totalValue),
        decision,
        cautions,
        // What to sell and buy to get back to the suggested mix (empty when no action is needed)
        suggestions: rebalance.suggestions,
        metrics,
        positions: positions.map((p) => ({
            ticker: p.ticker,
            name: p.name,
            sector: p.sector,
            quantity: p.quantity,
            price: p.price,
            value: round(p.value),
            currentPercent: round(p.currentPercent)
        })),
        agents: { risk, market: marketView, rebalance }
    };

    // The decision above is final; wording it (possibly with the LLM) is timed separately
    const explainStarted = performance.now();
    result.explanation = await explainDecision(result);
    metrics.explanationTimeMs = Math.round(performance.now() - explainStarted);
    return result;
}

module.exports = { runCouncil };
