# ReBalance AI

A council of three agents reviews a stock portfolio (Indian or US), raises cautions and
suggests what to sell and buy to get back in line. Suggestions are for the user to review:
the app never trades anything, and it is not financial advice.

## What it does

1. The user picks a market (India / US), a risk tolerance and an investment horizon, and enters their holdings.
2. The **Market Agent** fetches live prices, sector, 30-day trend and volatility for each stock.
3. The **Risk Agent** scores the portfolio's risk (0–100) and works out a suggested mix for this investor.
4. The **Rebalance Agent** measures how far each stock has drifted from that suggested mix.
5. The **Council** combines them into one verdict, `ATTENTION NEEDED` or `NO ACTION NEEDED`, with a list of cautions.
6. An **LLM (Google Gemini)** words the verdict in plain English. The verdict itself is always made by fixed rules.

```
React dashboard (:5173)
        │  /api/...  (Vite proxy)
        ▼
Express backend (:5001)
        │
     Council ──────────────► Explainer (Gemini, falls back to fixed text)
   ┌────┼──────────┐
 Risk  Market   Rebalance
Agent  Agent     Agent
        │
   Yahoo Finance ──► MongoDB cache (15 min) ──► built-in mock list (last resort)
```

## Project layout

```
backend/
  server.js                 Express app and routes
  agents/marketAgent.js     live stock data (yahoo-finance2) with cache and fallback
  agents/riskAgent.js       rule-based risk score, suggested mix, cautions
  agents/rebalanceAgent.js  drift from the suggested mix, cautions
  council/council.js        final verdict, all cautions, evaluation metrics
  council/explainer.js      plain-English explanation (Gemini or fixed template)
  routes/                   /api/market, /api/portfolio and /api/council
  db/                       MongoDB connection, stock cache, saved and sample portfolios
  utils/                    request validation and portfolio pricing
  data/mockStocks.js        placeholder data used only if Yahoo is unreachable
  data/samplePortfolios.js  sample portfolios, seeded into MongoDB at startup
frontend/
  src/App.jsx               navigation, shared portfolio state and live prices
  src/PortfolioPage.jsx     Portfolio page: value, P&L, holdings, buy/sell, charts, history
  src/History.jsx           table of buys and sells with date and time
  src/MarketsPage.jsx       Markets page: stock search and popular stocks, India / US
  src/StockDetail.jsx       one stock: price-history chart, key figures, your trades in it
  src/AllocationPie.jsx     donut chart used for allocations
  src/RebalancePage.jsx     Rebalance page: investor profile and the health check
  src/Results.jsx           verdict, agent cards, allocation chart, cautions, metrics
```

## Setup

Requires a recent Node.js (built and tested on Node 26).

```bash
cd backend && npm install
cd ../frontend && npm install
```

Create `backend/.env` from the example and fill it in:

```bash
cp backend/.env.example backend/.env
```

| Variable | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | optional | MongoDB connection string for the stock cache. Without it the cache is in memory. |
| `MONGODB_DB` | optional | Database name. Defaults to the one in the connection string. |
| `GEMINI_API_KEY` | optional | Google Gemini key for the explanation. Without it a fixed template is used. |
| `GEMINI_MODEL` | optional | Gemini model. Defaults to `gemini-flash-lite-latest`. |
| `PORT` | optional | Backend port. Defaults to 5001 (macOS uses 5000 for AirPlay). |

`backend/.env` is ignored by git. Never commit it.

## Run

Two terminals:

```bash
cd backend && node server.js
```

```bash
cd frontend && npm run dev
```

Open http://localhost:5173. Press **Load demo portfolio**, then open **Rebalance** and press **Analyze portfolio**.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Backend status and cache type (`mongodb` or `memory`) |
| GET | `/api/market/:market/search?q=REL` | Stock suggestions. `:market` is `IN` or `US` |
| GET | `/api/market/:market/quotes?tickers=A,B` | Live data per stock, plus a `notFound` list |
| GET | `/api/market/:market/stock/:ticker?range=1M` | One stock in full with price history (5D, 1M, 6M, 1Y) |
| GET | `/api/market/:market/popular` | Live data for 12 widely held stocks (Live market page) |
| GET | `/api/portfolio/:market/sample` | Sample portfolio, read from MongoDB |
| GET / PUT | `/api/portfolio/:market/saved` | Load or save the user's portfolio and its buy/sell history in MongoDB |
| GET | `/api/test-mongodb` | Writes one document to MongoDB and reads it back |
| POST | `/api/council` | Runs all agents and returns the verdict |

`POST /api/council` body:

```json
{
  "market": "IN",
  "riskTolerance": "medium",
  "horizonYears": 5,
  "holdings": [{ "ticker": "RELIANCE", "quantity": 60 }]
}
```

## The rules

All decisions are deterministic: the same input gives the same verdict.

**Risk score** — four factors, 0–25 points each:

| Factor | Points |
|---|---|
| Risk tolerance | low 25, medium 15, high 5 |
| Investment horizon | under 3 years 25, 3–7 years 15, over 7 years 5 |
| Concentration | largest holding at 15% or less scores 0, rising to 25 at 50% or more |
| Diversification | few holdings (up to 15) plus few sectors (up to 10) |

Below 35 is Low, 35–64 is Moderate, 65 and above is High.

**Suggested mix** — each stock is capped at a per-stock limit (20% low tolerance, 30% medium,
40% high; −5 for a short horizon, +5 for a long one; never below an equal split). Anything
above the limit is spread over the other stocks in proportion to their current weights.

**Drift** — a stock needs attention when it is 5 or more percentage points from its suggested share.

**Verdict** — `ATTENTION NEEDED` when any stock is past the drift threshold or overall risk is High.

**Suggestions** — when a stock is past the drift threshold, whole-share sells and buys that bring
every stock back to its suggested share. Buys never cost more than the sells raise; brokerage and tax are not counted.

**Market cautions** — a stock that fell more than 3% over 30 days, has volatility above 40%,
or moved 3% or more today. These are information only and never change the verdict.

## Evaluation metrics

- **Decision time** — price fetching, all agents and the Council, in milliseconds. The LLM explanation is timed separately.
- **Drift before** — the largest and average gap between each stock's share and its suggested share.
- **Drift after** — the same gaps if the suggested sells and buys were followed.
- **Drift reduction** — the share of average drift the suggestions remove.

## Limitations

- Market data comes from `yahoo-finance2`, an unofficial Yahoo Finance client. It can be rate-limited or change without notice. Indian stocks are NSE only.
- The LLM only rewords the Council's result. If it is slow or unavailable, the fixed template is used and the page says which one wrote the text.
- This is a hackathon project and not financial advice.
