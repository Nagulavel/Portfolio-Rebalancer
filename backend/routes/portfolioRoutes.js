const express = require("express");
const { isMarket } = require("../agents/marketAgent");
const { getPortfolio, savePortfolio } = require("../db/portfolioStore");

const router = express.Router();

router.param("market", (req, res, next, market) => {
    if (!isMarket(market)) return res.status(400).json({ error: "market must be IN or US" });
    next();
});

// GET /api/portfolio/IN/sample  and  /api/portfolio/IN/saved
//   -> { portfolio: { riskTolerance, horizonYears, holdings } | null, storedIn: "mongodb" | "memory" }
router.get("/:market/:kind", async (req, res, next) => {
    if (!["sample", "saved"].includes(req.params.kind)) return next();
    res.json(await getPortfolio(req.params.kind, req.params.market));
});

// PUT /api/portfolio/IN/saved
//   Body: { riskTolerance, horizonYears, holdings: [{ ticker, quantity, buyPrice }],
//           transactions: [{ at, ticker, name, type: "BUY" | "SELL", quantity, price, amount, realisedPnl }] }
router.put("/:market/saved", async (req, res) => {
    const { riskTolerance, horizonYears, holdings, transactions } = req.body || {};
    if (!["low", "medium", "high"].includes(riskTolerance)) {
        return res.status(400).json({ error: "riskTolerance must be low, medium or high" });
    }
    if (!Array.isArray(holdings)) return res.status(400).json({ error: "holdings must be a list" });

    const cleaned = holdings
        .map((h) => ({
            ticker: String(h?.ticker || "").trim().toUpperCase(),
            quantity: Number(h?.quantity) || 0,
            buyPrice: Number(h?.buyPrice) || null
        }))
        .filter((h) => h.ticker);
    // The history: every buy and sell, newest first
    const history = (Array.isArray(transactions) ? transactions : [])
        .filter((t) => ["BUY", "SELL"].includes(t?.type) && !Number.isNaN(Date.parse(t.at)))
        .slice(0, 500)
        .map((t) => ({
            at: new Date(t.at).toISOString(),
            ticker: String(t.ticker || "").trim().toUpperCase(),
            name: String(t.name || ""),
            type: t.type,
            quantity: Number(t.quantity) || 0,
            price: Number(t.price) || 0,
            amount: Number(t.amount) || 0,
            realisedPnl: t.realisedPnl == null ? null : Number(t.realisedPnl) || 0
        }));

    if (!cleaned.length && !history.length) return res.status(400).json({ error: "Add at least one stock before saving" });

    res.json(
        await savePortfolio(req.params.market, {
            riskTolerance,
            horizonYears: Number(horizonYears) || 5,
            holdings: cleaned,
            transactions: history
        })
    );
});

module.exports = router;
