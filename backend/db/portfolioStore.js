// Portfolio storage. MongoDB collection "portfolios" when connected, otherwise memory.
// One document per portfolio:
//   { _id: "sample:IN" | "saved:IN", market, kind, riskTolerance, horizonYears, holdings, transactions, updatedAt }

const { collection, dbStatus } = require("./mongo");
const SAMPLES = require("../data/samplePortfolios");

const memory = new Map();

// Writes the demo portfolios to the database, replacing any older copy
async function seedSamples() {
    for (const [market, sample] of Object.entries(SAMPLES)) {
        const doc = { market, kind: "sample", ...sample, updatedAt: new Date() };
        memory.set(`sample:${market}`, doc);
        const portfolios = collection("portfolios");
        if (portfolios) {
            await portfolios.replaceOne({ _id: `sample:${market}` }, doc, { upsert: true });
        }
    }
}

// kind: "sample" | "saved"  ->  { portfolio, storedIn } (portfolio is null when nothing is stored)
async function getPortfolio(kind, market) {
    const id = `${kind}:${market}`;
    const portfolios = collection("portfolios");
    if (portfolios) {
        const { _id, ...portfolio } = (await portfolios.findOne({ _id: id })) || {};
        return { portfolio: _id ? portfolio : null, storedIn: "mongodb" };
    }
    return { portfolio: memory.get(id) || null, storedIn: "memory" };
}

async function savePortfolio(market, { riskTolerance, horizonYears, holdings, transactions }) {
    const doc = { market, kind: "saved", riskTolerance, horizonYears, holdings, transactions, updatedAt: new Date() };
    memory.set(`saved:${market}`, doc);
    const portfolios = collection("portfolios");
    if (portfolios) await portfolios.replaceOne({ _id: `saved:${market}` }, doc, { upsert: true });
    return { portfolio: doc, storedIn: dbStatus() };
}

module.exports = { seedSamples, getPortfolio, savePortfolio };
