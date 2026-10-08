const express = require("express");
const { runCouncil } = require("../council/council");
const { loadPortfolio } = require("../utils/portfolioRequest");

const router = express.Router();

const startTimer = (req, res, next) => {
    req.startedAt = performance.now();
    next();
};

// POST /api/council — body described in utils/portfolioRequest.js
// The one endpoint the dashboard needs: runs all agents and returns the final decision.
router.post("/", startTimer, loadPortfolio, async (req, res) => {
    const result = await runCouncil(req.portfolio);
    // Fetching prices + all agents + the Council, without the time spent wording the explanation
    result.metrics.decisionTimeMs = Math.round(performance.now() - req.startedAt) - result.metrics.explanationTimeMs;
    res.json(result);
});

module.exports = router;
