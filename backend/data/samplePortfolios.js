// Demo portfolios. Written into MongoDB (collection "portfolios") at startup,
// and served from there by the "Load demo portfolio" button.
// transactions = the buys and sells that led to the holdings, newest first.

const tx = (at, ticker, name, type, quantity, price, realisedPnl = null) => ({
    at,
    ticker,
    name,
    type,
    quantity,
    price,
    amount: quantity * price,
    realisedPnl
});

module.exports = {
    IN: {
        riskTolerance: "medium",
        horizonYears: 5,
        holdings: [
            { ticker: "RELIANCE", quantity: 60, buyPrice: 1300 },
            { ticker: "TCS", quantity: 10, buyPrice: 2400 },
            { ticker: "HDFCBANK", quantity: 20, buyPrice: 650 },
            { ticker: "INFY", quantity: 15, buyPrice: 1100 },
            { ticker: "ITC", quantity: 30, buyPrice: 240 }
        ],
        transactions: [
            tx("2026-09-18T13:42:10+05:30", "RELIANCE", "Reliance Industries Limited", "SELL", 10, 1385, 850),
            tx("2026-09-02T10:05:31+05:30", "ITC", "ITC Limited", "BUY", 30, 240),
            tx("2026-08-21T11:27:48+05:30", "INFY", "Infosys Limited", "BUY", 15, 1100),
            tx("2026-08-06T14:51:02+05:30", "HDFCBANK", "HDFC Bank Limited", "BUY", 20, 650),
            tx("2026-07-23T09:48:15+05:30", "TCS", "Tata Consultancy Services Limited", "BUY", 10, 2400),
            tx("2026-07-14T10:12:44+05:30", "RELIANCE", "Reliance Industries Limited", "BUY", 70, 1300)
        ]
    },
    US: {
        riskTolerance: "medium",
        horizonYears: 5,
        holdings: [
            { ticker: "NVDA", quantity: 40, buyPrice: 150 },
            { ticker: "AAPL", quantity: 10, buyPrice: 300 },
            { ticker: "MSFT", quantity: 4, buyPrice: 480 },
            { ticker: "JPM", quantity: 8, buyPrice: 310 },
            { ticker: "KO", quantity: 30, buyPrice: 70 }
        ],
        transactions: [
            tx("2026-09-22T15:10:27-04:00", "NVDA", "NVIDIA Corporation", "SELL", 10, 210, 600),
            tx("2026-09-04T10:33:09-04:00", "KO", "The Coca-Cola Company", "BUY", 30, 70),
            tx("2026-08-19T11:02:54-04:00", "JPM", "JPMorgan Chase & Co.", "BUY", 8, 310),
            tx("2026-08-05T13:45:38-04:00", "MSFT", "Microsoft Corporation", "BUY", 4, 480),
            tx("2026-07-22T09:41:12-04:00", "AAPL", "Apple Inc.", "BUY", 10, 300),
            tx("2026-07-15T10:18:03-04:00", "NVDA", "NVIDIA Corporation", "BUY", 50, 150)
        ]
    }
};
