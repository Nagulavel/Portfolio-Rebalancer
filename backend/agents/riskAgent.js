// Risk Agent — deterministic, rule-based. No LLM, no randomness: same input, same output.
//
// riskAgent({ riskTolerance, horizonYears, positions })
//   riskTolerance: "low" | "medium" | "high"
//   horizonYears:  number of years the money stays invested
//   positions:     [{ ticker, sector, currentPercent }]
//
// Risk score = four factors, 0-25 points each (higher = riskier for THIS investor):
//   tolerance        low 25 · medium 15 · high 5
//   horizon          under 3y 25 · 3-7y 15 · over 7y 5
//   concentration    largest holding: 15% or less = 0 … 50% or more = 25
//   diversification  few holdings (0-15) + few sectors (0-10)
//
// Target allocation = current weights with every stock trimmed to a cap that
// depends on the investor (tolerance + horizon); the trimmed excess is spread
// over the other stocks in proportion to their current weights.
//
// Cautions = plain warnings (high overall risk, a stock over the cap, too few
// stocks or sectors). The agent never tells the user to buy or sell.

const TOLERANCE_POINTS = { low: 25, medium: 15, high: 5 };
const TOLERANCE_CAP = { low: 20, medium: 30, high: 40 }; // max % in one stock

const round = (n) => Math.round(n * 100) / 100;

const horizonBand = (years) => (years < 3 ? "short" : years <= 7 ? "medium" : "long");
const HORIZON_POINTS = { short: 25, medium: 15, long: 5 };
const HORIZON_CAP_ADJUST = { short: -5, medium: 0, long: 5 };

function concentrationPoints(largestPercent) {
    return round(Math.max(0, Math.min(25, ((largestPercent - 15) / 35) * 25)));
}

function diversificationPoints(holdingCount, sectorCount) {
    const holdingPoints = holdingCount < 3 ? 15 : holdingCount <= 5 ? 10 : holdingCount <= 9 ? 5 : 0;
    const sectorPoints = sectorCount === 1 ? 10 : sectorCount === 2 ? 7 : sectorCount === 3 ? 4 : 0;
    return holdingPoints + sectorPoints;
}

function capWeights(positions, cap) {
    const weights = positions.map((p) => p.currentPercent);
    const capped = weights.map(() => false);

    // Each pass caps at least one more stock, so this ends within positions.length passes
    for (let pass = 0; pass < weights.length; pass++) {
        let excess = 0;
        weights.forEach((w, i) => {
            if (w > cap + 1e-9) {
                excess += w - cap;
                weights[i] = cap;
                capped[i] = true;
            }
        });
        if (excess === 0) break;

        const open = weights.map((_, i) => i).filter((i) => !capped[i]);
        const openTotal = open.reduce((s, i) => s + weights[i], 0);
        open.forEach((i) => {
            weights[i] += openTotal > 0 ? (excess * weights[i]) / openTotal : excess / open.length;
        });
    }
    return weights;
}

function riskAgent({ riskTolerance, horizonYears, positions }) {
    const band = horizonBand(horizonYears);
    const largest = positions.reduce((a, b) => (b.currentPercent > a.currentPercent ? b : a));
    const held = positions.filter((p) => p.currentPercent > 0);
    const sectorCount = new Set(held.map((p) => p.sector)).size;

    const factors = {
        tolerance: TOLERANCE_POINTS[riskTolerance],
        horizon: HORIZON_POINTS[band],
        concentration: concentrationPoints(largest.currentPercent),
        diversification: diversificationPoints(held.length, sectorCount)
    };
    const riskScore = Math.round(factors.tolerance + factors.horizon + factors.concentration + factors.diversification);
    const riskLevel = riskScore < 35 ? "Low" : riskScore < 65 ? "Moderate" : "High";

    // With few stocks the cap may be impossible (3 stocks cannot each be under 20%),
    // so never go below an equal split.
    const profileCap = TOLERANCE_CAP[riskTolerance] + HORIZON_CAP_ADJUST[band];
    const maxPerStock = Math.max(profileCap, 100 / positions.length);
    const targets = capWeights(positions, maxPerStock);

    const targetAllocation = positions.map((p, i) => ({
        ticker: p.ticker,
        sector: p.sector,
        currentPercent: round(p.currentPercent),
        targetPercent: round(targets[i])
    }));
    const limit = round(maxPerStock);
    const overLimit = targetAllocation.filter((t) => t.currentPercent > limit + 0.01);

    const cautions = [];
    if (riskLevel === "High") {
        cautions.push({
            severity: "high",
            message: `Overall risk is High (${riskScore}/100) for a ${riskTolerance}-tolerance investor with a ${horizonYears}-year horizon.`
        });
    }
    for (const t of overLimit) {
        cautions.push({
            ticker: t.ticker,
            severity: "high",
            message: `${t.ticker} is ${t.currentPercent}% of your portfolio, above the ${limit}% per-stock limit for your profile.`
        });
    }
    if (held.length <= 5) {
        cautions.push({ severity: "medium", message: `Only ${held.length} stock${held.length === 1 ? "" : "s"} held — a fall in any one has a large effect.` });
    }
    if (sectorCount <= 2) {
        cautions.push({ severity: "medium", message: `Holdings sit in only ${sectorCount} sector${sectorCount === 1 ? "" : "s"} — little protection if that sector falls.` });
    }

    return {
        agent: "Risk Agent",
        riskScore,
        riskLevel,
        factors,
        details: {
            riskTolerance,
            horizonYears,
            horizonBand: band,
            largestHolding: { ticker: largest.ticker, percent: round(largest.currentPercent) },
            holdingCount: held.length,
            sectorCount,
            maxPerStock: round(maxPerStock)
        },
        targetAllocation,
        cautions,
        reasoning:
            `Risk is ${riskLevel} (${riskScore}/100): tolerance ${factors.tolerance}, horizon ${factors.horizon}, ` +
            `concentration ${factors.concentration}, diversification ${factors.diversification}. ` +
            (overLimit.length
                ? `${overLimit.map((t) => t.ticker).join(", ")} above the ${limit}% per-stock limit for this investor.`
                : `No stock is above the ${limit}% per-stock limit for this investor.`)
    };
}

module.exports = riskAgent;
