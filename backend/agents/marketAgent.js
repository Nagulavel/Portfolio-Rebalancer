// Market Agent — fetches live stock data from Yahoo Finance (via yahoo-finance2).
//
// Contract used by the rest of the app:
//   searchStocks(market, query)     -> [{ ticker, name }]
//   getMarketData(market, tickers)  -> { [ticker]: StockData }   (unknown tickers are left out)
//   getPopularStocks(market)        -> [StockData]
//   getStockDetail(market, ticker, range) -> StockData + { range, stats, history: [{ time, close }] }
//
// StockData = {
//   ticker, name, price, currency, sector,
//   changePercent,   // today's move, %
//   change30d,       // move over the last ~30 trading days, %
//   volatility,      // annualised %, from daily returns over the same period
//   trend,           // "bullish" | "bearish" | "neutral" (change30d beyond ±3%)
//   source           // "live" | "cache" | "mock"
// }

const YahooFinance = require("yahoo-finance2").default;
const MOCK_STOCKS = require("../data/mockStocks");
const { getCached, saveCached } = require("../db/stockCache");

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const MARKETS = {
    // NSE listings on Yahoo end in .NS. "popular" feeds the Live market page.
    IN: {
        currency: "₹",
        suffix: ".NS",
        popular: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "ITC", "SBIN", "BHARTIARTL", "LT", "HINDUNILVR", "TATASTEEL", "SUNPHARMA"]
    },
    US: {
        currency: "$",
        suffix: "",
        popular: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "KO", "XOM", "JNJ", "WMT"]
    }
};

const CACHE_MINUTES = 15; // cached copies live in MongoDB (see db/stockCache.js)

const round = (n) => Math.round(n * 100) / 100;

function historyStats(closes) {
    if (closes.length < 2) return { change30d: 0, volatility: 0, trend: "neutral" };

    const returns = [];
    for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;

    const change30d = (closes[closes.length - 1] / closes[0] - 1) * 100;
    return {
        change30d: round(change30d),
        volatility: round(Math.sqrt(variance) * Math.sqrt(252) * 100),
        trend: change30d > 3 ? "bullish" : change30d < -3 ? "bearish" : "neutral"
    };
}

async function fetchLive(market, ticker) {
    const symbol = ticker + MARKETS[market].suffix;

    const quote = await yahoo.quote(symbol);
    if (!quote || quote.regularMarketPrice == null) return null;

    // Sector and history are extras — a failure here should not lose the price
    const [profile, chart] = await Promise.all([
        yahoo.quoteSummary(symbol, { modules: ["assetProfile"] }).catch(() => null),
        yahoo.chart(symbol, { period1: new Date(Date.now() - 45 * 86400000), interval: "1d" }).catch(() => null)
    ]);
    const closes = chart ? chart.quotes.map((q) => q.close).filter((c) => c != null) : [];

    return {
        ticker,
        name: quote.longName || quote.shortName || ticker,
        price: round(quote.regularMarketPrice),
        currency: MARKETS[market].currency,
        sector: profile?.assetProfile?.sector || "Unknown",
        changePercent: round(quote.regularMarketChangePercent || 0),
        ...historyStats(closes),
        source: "live"
    };
}

async function getOne(market, ticker) {
    const cached = await getCached(market, ticker);
    if (cached && Date.now() - new Date(cached.savedAt).getTime() < CACHE_MINUTES * 60000) {
        return { ...cached.data, source: "cache" };
    }

    try {
        const data = await fetchLive(market, ticker);
        if (data) await saveCached(market, ticker, data);
        return data;
    } catch (err) {
        console.error(`Market Agent: live fetch failed for ${market}:${ticker} — ${err.message}`);
        // Yahoo is down or blocking us: serve stale cache, then the built-in list
        if (cached) return { ...cached.data, source: "cache" };
        const mock = MOCK_STOCKS[market][ticker];
        return mock ? { ticker, currency: MARKETS[market].currency, ...mock, source: "mock" } : null;
    }
}

async function getMarketData(market, tickers) {
    const results = await Promise.all(tickers.map((t) => getOne(market, t)));
    const data = {};
    results.forEach((r) => {
        if (r) data[r.ticker] = r;
    });
    return data;
}

function searchMock(market, query) {
    const q = query.toUpperCase();
    return Object.entries(MOCK_STOCKS[market])
        .filter(([ticker, s]) => ticker.includes(q) || s.name.toUpperCase().includes(q))
        .map(([ticker, s]) => ({ ticker, name: s.name }));
}

async function searchStocks(market, query) {
    const { suffix } = MARKETS[market];
    try {
        const res = await yahoo.search(query, { quotesCount: 20, newsCount: 0 });
        return res.quotes
            .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
            // India: only NSE symbols. US: symbols with no exchange suffix.
            .filter((q) => (suffix ? q.symbol.endsWith(suffix) : !q.symbol.includes(".")))
            .slice(0, 8)
            .map((q) => ({
                ticker: suffix ? q.symbol.slice(0, -suffix.length) : q.symbol,
                name: q.longname || q.shortname || q.symbol
            }));
    } catch (err) {
        console.error(`Market Agent: search failed for "${query}" — ${err.message}`);
        return searchMock(market, query);
    }
}

// Price-history ranges for the stock detail page
const RANGES = {
    "5D": { days: 5, interval: "30m" },
    "1M": { days: 30, interval: "1d" },
    "6M": { days: 182, interval: "1d" },
    "1Y": { days: 365, interval: "1wk" }
};
const detailCache = new Map(); // "IN:TCS:1M" -> { detail, savedAt }

// Everything about one stock: live data, day and 52-week figures, and its price history
async function getStockDetail(market, ticker, range) {
    const stock = (await getMarketData(market, [ticker]))[ticker];
    if (!stock) return null;

    const key = `${market}:${ticker}:${range}`;
    const cached = detailCache.get(key);
    if (cached && Date.now() - cached.savedAt < CACHE_MINUTES * 60000) return cached.detail;

    const symbol = ticker + MARKETS[market].suffix;
    const { days, interval } = RANGES[range];
    const [quote, chart] = await Promise.all([
        yahoo.quote(symbol).catch(() => null),
        yahoo.chart(symbol, { period1: new Date(Date.now() - days * 86400000), interval }).catch(() => null)
    ]);

    const detail = {
        ...stock,
        range,
        stats: {
            exchange: quote?.fullExchangeName ?? null,
            open: quote?.regularMarketOpen ?? null,
            previousClose: quote?.regularMarketPreviousClose ?? null,
            dayHigh: quote?.regularMarketDayHigh ?? null,
            dayLow: quote?.regularMarketDayLow ?? null,
            yearHigh: quote?.fiftyTwoWeekHigh ?? null,
            yearLow: quote?.fiftyTwoWeekLow ?? null,
            volume: quote?.regularMarketVolume ?? null,
            marketCap: quote?.marketCap ?? null,
            peRatio: quote?.trailingPE ?? null
        },
        history: (chart?.quotes || []).filter((q) => q.close != null).map((q) => ({ time: q.date.toISOString(), close: round(q.close) }))
    };
    if (chart) detailCache.set(key, { detail, savedAt: Date.now() });
    return detail;
}

const isRange = (range) => Object.hasOwn(RANGES, range);

// Live data for a fixed list of widely held stocks, in list order
async function getPopularStocks(market) {
    const data = await getMarketData(market, MARKETS[market].popular);
    return MARKETS[market].popular.map((t) => data[t]).filter(Boolean);
}

const isMarket = (market) => Object.hasOwn(MARKETS, market);

module.exports = { getMarketData, getPopularStocks, getStockDetail, searchStocks, isMarket, isRange };
