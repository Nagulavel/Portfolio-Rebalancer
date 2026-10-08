// Fallback data, used ONLY when Yahoo Finance cannot be reached.
// These numbers are placeholders, not real prices.

module.exports = {
    IN: {
        RELIANCE: { name: "Reliance Industries Limited", price: 1200, sector: "Energy", changePercent: 0, change30d: 1, volatility: 22, trend: "neutral" },
        TCS: { name: "Tata Consultancy Services Limited", price: 3000, sector: "Technology", changePercent: 0, change30d: -4, volatility: 20, trend: "bearish" },
        INFY: { name: "Infosys Limited", price: 1500, sector: "Technology", changePercent: 0, change30d: -3.5, volatility: 24, trend: "bearish" },
        HDFCBANK: { name: "HDFC Bank Limited", price: 950, sector: "Financial Services", changePercent: 0, change30d: 4, volatility: 18, trend: "bullish" },
        ITC: { name: "ITC Limited", price: 400, sector: "Consumer Defensive", changePercent: 0, change30d: 0.5, volatility: 16, trend: "neutral" }
    },
    US: {
        AAPL: { name: "Apple Inc.", price: 330, sector: "Technology", changePercent: 0, change30d: 1.5, volatility: 24, trend: "neutral" },
        MSFT: { name: "Microsoft Corporation", price: 520, sector: "Technology", changePercent: 0, change30d: 3.5, volatility: 22, trend: "bullish" },
        NVDA: { name: "NVIDIA Corporation", price: 185, sector: "Technology", changePercent: 0, change30d: 8, volatility: 45, trend: "bullish" },
        JPM: { name: "JPMorgan Chase & Co.", price: 310, sector: "Financial Services", changePercent: 0, change30d: 3.2, volatility: 20, trend: "bullish" },
        KO: { name: "The Coca-Cola Company", price: 67, sector: "Consumer Defensive", changePercent: 0, change30d: -0.5, volatility: 13, trend: "neutral" }
    }
};
