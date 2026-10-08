// Explanation layer — turns the Council's result into plain English.
//
// The verdict is already made by the rules in council.js; this file only words it.
// Suggested trades are always worded as suggestions to review, never as instructions.
//   - GEMINI_API_KEY set in backend/.env -> Google Gemini writes it (source: "llm")
//   - no key, or the call fails/times out -> the fixed template below (source: "rules")
// The LLM is told to use only the facts it is given, so it cannot change the decision.

const axios = require("axios");

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-flash-lite-latest";
const TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `You explain a portfolio health check to a retail investor.
You are given the final verdict and the facts behind it as JSON. The verdict is final.
Rules:
- Use ONLY the facts and numbers in the JSON. Never invent or change a number or a stock.
- The "suggestions" list holds the suggested trades. Describe them exactly as given, as
  suggestions to consider ("the suggestion is to sell 30 RELIANCE"). Never add a trade that
  is not in the list, never word one as an instruction, and give no predictions.
- Write 4 to 6 short sentences of plain English in one paragraph. No lists, no markdown, no headings.
- Cover: the risk level and what drives it, why the verdict was reached, the most important
  cautions, and the suggested sells and buys. If there are no suggestions, say none are needed.
- Drift is measured in percentage points ("points"), not percent.
- End by saying these are suggestions for the investor to review, not financial advice.
- Use the currency symbol given.`;

// Only what the LLM needs — keeps the prompt small and the wording grounded
function factsFor(result) {
    const { risk, rebalance } = result.agents;
    return {
        verdict: result.decision,
        currency: result.currency,
        portfolioValue: result.totalValue,
        risk: { scoreOutOf100: risk.riskScore, level: risk.riskLevel, factorPointsEachOutOf25: risk.factors, ...risk.details },
        driftThresholdPoints: rebalance.driftThreshold,
        largestDriftPoints: rebalance.maxDrift,
        holdings: rebalance.drifts.map((d) => ({ ticker: d.ticker, currentPercent: d.currentPercent, status: d.status })),
        cautions: result.cautions.map((c) => ({ from: c.agent, severity: c.severity, message: c.message })),
        suggestions: result.suggestions.map((t) => ({ action: t.action, ticker: t.ticker, shares: t.shares, amount: t.amount, reason: t.reason }))
    };
}

async function explainWithLLM(result) {
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const res = await axios.post(
        `${GEMINI_URL}/${model}:generateContent`,
        {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify(factsFor(result)) }] }],
            // Generous limit: some Gemini models spend output tokens on thinking first
            generationConfig: { temperature: 0, maxOutputTokens: 2000 }
        },
        { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY }, timeout: TIMEOUT_MS }
    );
    const parts = res.data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();
    if (!text) throw new Error("empty response");
    return { text, source: "llm", model };
}

function explainWithRules(result) {
    const { decision, agents, cautions } = result;
    const { risk, rebalance } = agents;
    const parts = [];

    parts.push(`Your portfolio's risk is ${risk.riskLevel} (${risk.riskScore}/100).`);
    parts.push(
        decision === "ATTENTION_NEEDED"
            ? `The Council says it needs your attention: ${rebalance.needsAttention ? rebalance.reasoning : "the overall risk is high for your profile."}`
            : `The Council sees nothing that needs action: ${rebalance.reasoning}`
    );

    const high = cautions.filter((c) => c.severity === "high");
    if (high.length) parts.push(`Most important: ${high.map((c) => c.message).join(" ")}`);
    if (cautions.length > high.length) parts.push(`There ${cautions.length - high.length === 1 ? "is 1 other caution" : `are ${cautions.length - high.length} other cautions`} below.`);
    if (!cautions.length) parts.push("No agent raised a caution.");

    const { suggestions } = result;
    const list = (action) => suggestions.filter((t) => t.action === action).map((t) => `${t.shares} ${t.ticker}`).join(", ");
    if (suggestions.length) {
        parts.push(`To get back in line, the suggestion is to ${[list("SELL") && `sell ${list("SELL")}`, list("BUY") && `buy ${list("BUY")}`].filter(Boolean).join(" and ")}.`);
    }

    parts.push("These are suggestions for you to review, not financial advice.");
    return parts.join(" ");
}

async function explainDecision(result) {
    if (process.env.GEMINI_API_KEY) {
        try {
            return await explainWithLLM(result);
        } catch (err) {
            const detail = err.response?.data?.error?.message || err.message;
            console.error(`Explainer: LLM call failed, using rule-based text — ${detail}`);
        }
    }
    return { text: explainWithRules(result), source: "rules" };
}

module.exports = { explainDecision };
