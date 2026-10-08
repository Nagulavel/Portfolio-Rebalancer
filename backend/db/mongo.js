// MongoDB connection. Optional: with no MONGODB_URI in backend/.env (or if the
// database cannot be reached) the app runs without it and caches in memory.

const { MongoClient } = require("mongodb");

let db = null;

async function connectDb() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log("MongoDB: no MONGODB_URI set — using in-memory cache");
        return;
    }
    try {
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        // No MONGODB_DB -> the database named in the connection string
        db = client.db(process.env.MONGODB_DB || undefined);
        console.log(`MongoDB: connected to database "${db.databaseName}"`);
    } catch (err) {
        console.error(`MongoDB: connection failed, using in-memory cache — ${err.message}`);
    }
}

// Returns the collection, or null when MongoDB is not connected
const collection = (name) => (db ? db.collection(name) : null);

const dbStatus = () => (db ? "mongodb" : "memory");

module.exports = { connectDb, collection, dbStatus };
