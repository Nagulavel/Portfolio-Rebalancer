// Always load backend/.env, whichever folder the server is started from
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { connectDb, collection, dbStatus } = require("./db/mongo");
const { seedSamples } = require("./db/portfolioStore");

const app = express();
// macOS AirPlay Receiver already listens on 5000, so default to 5001
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "ReBalance AI Backend Running"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Backend connected",
        cache: dbStatus()
    });
});

app.use("/api/market", require("./routes/marketRoutes"));
app.use("/api/portfolio", require("./routes/portfolioRoutes"));
app.use("/api/council", require("./routes/councilRoutes"));

// Writes one document to the "test" collection and reads it back
app.get("/api/test-mongodb", async (req, res) => {
    try {
        // The app connects with the MongoDB driver in db/mongo.js (not mongoose)
        const testCollection = collection("test");
        if (!testCollection) throw new Error("MongoDB is not connected — check MONGODB_URI in backend/.env");

        await testCollection.insertOne({
            message: "MongoDB is working!",
            time: new Date()
        });

        const data = await testCollection.findOne({
            message: "MongoDB is working!"
        });

        res.json({
            success: true,
            message: "MongoDB CRUD test successful",
            data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Any unexpected error becomes a JSON reply the page can show
app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ error: status < 500 ? "Invalid request" : "Something went wrong on the server" });
});

connectDb()
    .then(seedSamples)
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    });
