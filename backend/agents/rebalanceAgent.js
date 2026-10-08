// Rebalance Agent — deterministic. Measures how far each stock has drifted from the
// Risk Agent's suggested mix, raises cautions, and suggests what to sell and buy to
// get back in line. Suggestions are for the user to review; nothing is ever traded.
//
// rebalanceAgent({ positions, totalValue, targetAllocation })
//   positions:        [{ ticker, price, value, currentPercent }]
//   targetAllocation: [{ ticker, targetPercent }]   (from the Risk Agent)
//
// Rules:
//   - A stock needs attention when it is DRIFT_THRESHOLD points or more off its suggested share.
//   - Suggestions come from a whole-share, self-funded rebalance: buys never cost more
//     than the sells raise. No brokerage or tax is counted.
//   - Suggestions are only given when at least one stock needs attention.

const DRIFT_THRESHOLD = 5; // percentage points

const round = (n) => Math.round(n * 100) / 100;

// -> { shares: { [ticker]: +buy / -sell }, values: { [ticker]: value afterwards } }
function simulateRebalance(positions, totalValue, targetOf) {
    const targetValue = (p) => (targetOf[p.ticker] / 100) * totalValue;
    const shares = Object.fromEntries(positions.map((p) => [p.ticker, Math.trunc((targetValue(p) - p.value) / p.price)]));
    const valueAfter = (p) => p.value + shares[p.ticker] * p.price;
    const cash = () => -positions.reduce((s, p) => s + shares[p.ticker] * p.price, 0);

    // Whole-share rounding can leave the buys costing more than the sells raise: trim the cheapest buy
    while (cash() < 0) {
        const cheapest = positions.filter((p) => shares[p.ticker] > 0).reduce((a, b) => (b.price < a.price ? b : a));
        shares[cheapest.ticker] -= 1;
    }
    // ...or leave spare cash: spend it on whichever stock is furthest below its share
    for (;;) {
        const spare = cash();
        const short = positions
            .filter((p) => shares[p.ticker] >= 0 && p.price <= spare && targetValue(p) > valueAfter(p))
            .sort((a, b) => targetValue(b) - valueAfter(b) - (targetValue(a) - valueAfter(a)))[0];
        if (!short) break;
        shares[short.ticker] += 1;
    }

    return { shares, values: Object.fromEntries(positions.map((p) => [p.ticker, valueAfter(p)])) };
}

function rebalanceAgent({ positions, totalValue, targetAllocation }) {
    const targetOf = Object.fromEntries(targetAllocation.map((t) => [t.ticker, t.targetPercent]));
    const simulated = simulateRebalance(positions, totalValue, targetOf);

    const drifts = positions.map((p) => {
        const drift = round(p.currentPercent - targetOf[p.ticker]);
        return {
            ticker: p.ticker,
            currentPercent: round(p.currentPercent),
            suggestedPercent: targetOf[p.ticker],
            drift,
            status: Math.abs(drift) < DRIFT_THRESHOLD ? "on track" : drift > 0 ? "overweight" : "underweight",
            projectedPercent: round((simulated.values[p.ticker] / totalValue) * 100)
        };
    });

    const cautions = drifts
        .filter((d) => d.status !== "on track")
        .map((d) => ({
            ticker: d.ticker,
            severity: Math.abs(d.drift) >= 2 * DRIFT_THRESHOLD ? "high" : "medium",
            message:
                d.status === "overweight"
                    ? `${d.ticker} is ${d.currentPercent}% of your portfolio, ${d.drift} points above its suggested share of ${d.suggestedPercent}%.`
                    : `${d.ticker} is ${d.currentPercent}% of your portfolio, ${Math.abs(d.drift)} points below its suggested share of ${d.suggestedPercent}%.`
        }));

    const worst = drifts.reduce((a, b) => (Math.abs(b.drift) > Math.abs(a.drift) ? b : a));
    const maxDrift = Math.abs(worst.drift);
    const needsAttention = maxDrift >= DRIFT_THRESHOLD;

    const suggestions = !needsAttention
        ? []
        : positions
              .filter((p) => simulated.shares[p.ticker] !== 0)
              .map((p) => {
                  const shares = simulated.shares[p.ticker];
                  const d = drifts.find((x) => x.ticker === p.ticker);
                  return {
                      ticker: p.ticker,
                      action: shares > 0 ? "BUY" : "SELL",
                      shares: Math.abs(shares),
                      price: p.price,
                      amount: round(Math.abs(shares) * p.price),
                      reason: `${Math.abs(d.drift)} points ${d.drift > 0 ? "above" : "below"} its suggested share of ${d.suggestedPercent}%`,
                      afterPercent: d.projectedPercent
                  };
              });

    return {
        agent: "Rebalance Agent",
        needsAttention,
        driftThreshold: DRIFT_THRESHOLD,
        maxDrift,
        drifts,
        cautions,
        suggestions,
        reasoning: needsAttention
            ? `${worst.ticker} is ${maxDrift} points away from its suggested share, past the ${DRIFT_THRESHOLD}-point threshold.`
            : `Largest drift is ${maxDrift} points (${worst.ticker}), inside the ${DRIFT_THRESHOLD}-point threshold.`
    };
}

module.exports = rebalanceAgent;
