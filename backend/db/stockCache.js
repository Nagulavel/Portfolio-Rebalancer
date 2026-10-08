// Stock cache for the Market Agent. Stored in MongoDB (collection "stocks") when
// connected, otherwise in memory. One document per stock:
//   { _id: "IN:RELIANCE", market, ticker, data: StockData, savedAt: Date }

const { collection } = require("./mongo");

const memory = new Map();

// -> { data, savedAt: Date } or null
async function getCached(market, ticker) {
    const key = `${market}:${ticker}`;
    const stocks = collection("stocks");
    if (stocks) {
        try {
            return await stocks.findOne({ _id: key });
        } catch (err) {
            console.error(`Stock cache: read failed for ${key} — ${err.message}`);
        }
    }
    return memory.get(key) || null;
}

async function saveCached(market, ticker, data) {
    const key = `${market}:${ticker}`;
    const doc = { market, ticker, data, savedAt: new Date() };
    memory.set(key, doc);
    const stocks = collection("stocks");
    if (stocks) {
        try {
            await stocks.updateOne({ _id: key }, { $set: doc }, { upsert: true });
        } catch (err) {
            console.error(`Stock cache: write failed for ${key} — ${err.message}`);
        }
    }
}

module.exports = { getCached, saveCached };
