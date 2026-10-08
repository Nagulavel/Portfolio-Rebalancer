const { isMarket } = require("../agents/marketAgent");
const { buildPositions } = require("./portfolio");

// Express middleware shared by the agent routes. Validates the body:
//   { market: "IN" | "US", riskTolerance: "low" | "medium" | "high", horizonYears: 5,
//     holdings: [{ ticker, quantity }] }
// then prices it with the Market Agent and sets req.portfolio =
//   { market, riskTolerance, horizonYears, positions, totalValue }
async function loadPortfolio(req, res, next) {
    const { market, riskTolerance, horizonYears, holdings } = req.body || {};

    if (!isMarket(market)) return res.status(400).json({ error: "market must be IN or US" });
    if (!["low", "medium", "high"].includes(riskTolerance)) {
        return res.status(400).json({ error: "riskTolerance must be low, medium or high" });
    }
    const years = Number(horizonYears);
    if (horizonYears == null || !Number.isFinite(years) || years <= 0) {
        return res.status(400).json({ error: "horizonYears must be a number above 0" });
    }
    if (!Array.isArray(holdings) || holdings.length === 0) {
        return res.status(400).json({ error: "Add at least one holding" });
    }

    const cleaned = holdings.map((h) => ({
        ticker: String(h?.ticker || "").trim().toUpperCase(),
        quantity: Number(h?.quantity)
    }));
    for (const h of cleaned) {
        if (!h.ticker) return res.status(400).json({ error: "Every holding needs a ticker" });
        if (!Number.isFinite(h.quantity) || h.quantity < 0) {
            return res.status(400).json({ error: `${h.ticker}: quantity must be 0 or more` });
        }
    }
    if (new Set(cleaned.map((h) => h.ticker)).size !== cleaned.length) {
        return res.status(400).json({ error: "Each ticker can only appear once" });
    }

    const { positions, totalValue, notFound } = await buildPositions(market, cleaned);
    if (notFound.length) return res.status(400).json({ error: `Stock not found: ${notFound.join(", ")}` });
    if (totalValue === 0) return res.status(400).json({ error: "At least one holding needs a quantity above 0" });

    req.portfolio = { market, riskTolerance, horizonYears: years, positions, totalValue };
    next();
}

module.exports = { loadPortfolio };
