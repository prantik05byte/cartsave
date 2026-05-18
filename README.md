# CartSave — AI-Powered Checkout Recovery Agent

Real-time conversational widget that detects buyer friction at checkout and recovers abandonment in-session using Claude AI.

## Quick Start

### 1. Backend
```bash
cd backend
npm install
cp ../.env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the demo checkout page with CartSave widget is ready.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Claude API key |
| `SHOPIFY_STORE_DOMAIN` | Optional | e.g. `your-store.myshopify.com` |
| `SHOPIFY_STOREFRONT_TOKEN` | Optional | Storefront API token |
| `PORT` | Optional | Backend port (default 3001) |

> Without Shopify credentials, the app uses rich mock cart data — perfect for demos.

## Architecture

```
Browser (checkout page)
  └── FrictionDetector.ts      ← DOM event listeners
  └── useRecoverySession.ts    ← Signal batching + session mgmt
  └── CheckoutRecoveryWidget   ← Chat UI (all 6 states)
        │
        ▼ POST /api/friction/detect
        ▼ POST /api/chat/message
        ▼ POST /api/session/outcome

Express Backend (port 3001)
  ├── frictionEngine.js        ← Weighted signal scoring
  ├── claudeService.js         ← Claude API + failure handling
  ├── shopifyService.js        ← Storefront GraphQL
  └── SQLite DB                ← Sessions + messages
```

## Failure Handling (7 cases)

1. **Claude timeout** → 15s timeout → retry once → static fallback per friction type
2. **Shopify down** → cart cached at session start → conversation continues
3. **Malformed response** → strip markdown → truncate >200 chars → retry stricter
4. **No friction** → widget stays hidden, never interrupts smooth checkout
5. **Session expires** → conversation preserved in localStorage → restored on reload
6. **Invalid discount** → API returns error → Claude acknowledges → suggests alternative
7. **Rate limiting** → per-session message queue → sequential processing

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/session/start` | POST | Begin session, cache cart |
| `/api/session/outcome` | POST | Log recovered/abandoned/escalated |
| `/api/friction/detect` | POST | Analyze signals, get friction type |
| `/api/chat/message` | POST | Send message, get Claude reply |
| `/api/chat/history/:id` | GET | Restore conversation |
| `/api/analytics/summary` | GET | Recovery metrics |
| `/health` | GET | Health check |
