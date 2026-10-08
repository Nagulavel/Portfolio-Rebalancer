const express = require("express");
const { getMarketData, getPopularStocks, getStockDetail, searchStocks, isMarket, isRange } = require("../agents/marketAgent");

const router = express.Router();

router.param("market", (req, res, next, market) => {
    if (!isMarket(market)) return res.status(400).json({ error: "market must be IN or US" });
    next();
});

// GET /api/market/IN/search?q=REL  -> [{ ticker, name }]
router.get("/:market/search", async (req, res) => {
    // Yahoo's search returns nothing for some lowercase queries
    const q = String(req.query.q || "").trim().toUpperCase();
    if (!q) return res.json([]);
    res.json(await searchStocks(req.params.market, q));
});

// GET /api/market/IN/popular  -> [StockData] for the Live market page
router.get("/:market/popular", async (req, res) => {
    res.json(await getPopularStocks(req.params.market));
});

// GET /api/market/IN/stock/TCS?range=1M  -> one stock in full, with price history
// range: 5D | 1M | 6M | 1Y
router.get("/:market/stock/:ticker", async (req, res) => {
    const range = String(req.query.range || "1M").toUpperCase();
    if (!isRange(range)) return res.status(400).json({ error: "range must be 5D, 1M, 6M or 1Y" });

    const detail = await getStockDetail(req.params.market, req.params.ticker.trim().toUpperCase(), range);
    if (!detail) return res.status(404).json({ error: "Stock not found" });
    res.json(detail);
});

// GET /api/market/IN/quotes?tickers=RELIANCE,TCS  -> { stocks: {...}, notFound: [...] }
router.get("/:market/quotes", async (req, res) => {
    const tickers = [
        ...new Set(
            String(req.query.tickers || "")
                .split(",")
                .map((t) => t.trim().toUpperCase())
                .filter(Boolean)
        )
    ];
    if (!tickers.length) return res.status(400).json({ error: "Pass ?tickers=A,B,C" });

    const stocks = await getMarketData(req.params.market, tickers);
    res.json({ stocks, notFound: tickers.filter((t) => !stocks[t]) });
});

module.exports = router;
