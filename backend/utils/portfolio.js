const { getMarketData } = require("../agents/marketAgent");

// Prices the holdings with the Market Agent and works out each one's share of the portfolio.
// holdings: [{ ticker, quantity }]  ->  { positions, totalValue, notFound }
async function buildPositions(market, holdings) {
    const marketData = await getMarketData(market, holdings.map((h) => h.ticker));
    const notFound = holdings.filter((h) => !marketData[h.ticker]).map((h) => h.ticker);
    if (notFound.length) return { positions: [], totalValue: 0, notFound };

    const valued = holdings.map((h) => ({
        ...h,
        ...marketData[h.ticker],
        value: h.quantity * marketData[h.ticker].price
    }));
    const totalValue = valued.reduce((s, p) => s + p.value, 0);
    const positions = valued.map((p) => ({
        ...p,
        currentPercent: totalValue ? (p.value / totalValue) * 100 : 0
    }));

    return { positions, totalValue, notFound };
}

module.exports = { buildPositions };
