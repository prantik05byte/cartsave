# CartSave — Technical Document
**Kasparro Agentic Commerce Hackathon | Track 2: AI-Assisted Checkout Recovery**

---

## 1. System Architecture: Components, Data Flow, and How They Connect

CartSave consists of four main components that communicate over HTTP and WebSocket.

```
┌─────────────────────────────────────────────────┐
│              SHOPIFY CHECKOUT PAGE               │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │         FrictionDetector.ts              │   │
│  │  (Behavioral signal monitoring - JS)     │   │
│  └────────────────┬─────────────────────────┘   │
│                   │ friction signal detected     │
│  ┌────────────────▼─────────────────────────┐   │
│  │     CheckoutRecoveryWidget.tsx           │   │
│  │       (React chat widget - UI)           │   │
│  └────────────────┬─────────────────────────┘   │
└───────────────────┼─────────────────────────────┘
                    │ HTTPS POST
                    ▼
┌─────────────────────────────────────────────────┐
│              CARTSAVE BACKEND (Node.js)          │
│                                                 │
│  Routes: /session /friction /chat /analytics    │
│                                                 │
│  ┌─────────────┐  ┌──────────────┐             │
│  │FrictionEngine│  │ClaudeService │             │
│  └─────────────┘  └──────┬───────┘             │
│  ┌─────────────┐         │                      │
│  │ShopifyService│         │                      │
│  └──────┬──────┘         │                      │
└─────────┼────────────────┼─────────────────────┘
          │                │
          ▼                ▼
  ┌──────────────┐  ┌──────────────────┐
  │ Shopify      │  │  Anthropic       │
  │ Storefront   │  │  Claude API      │
  │ GraphQL API  │  │  (claude-sonnet) │
  └──────────────┘  └──────────────────┘
```

**Data flow for a single recovery session:**

1. Widget script loads on checkout page → POST `/api/session/start` → session ID returned
2. FrictionDetector emits signals → POST `/api/friction/detect` → friction type + trigger decision
3. If triggered: ShopifyService fetches cart + policies → assembled into Claude context
4. User message → POST `/api/chat/message` → ClaudeService generates response → returned to widget
5. Actions (apply coupon, etc.) → POST `/api/action/apply` → Shopify Storefront API → result
6. Session ends → POST `/api/session/outcome` → logged to database

---

## 2. Key Implementation Decisions and Why We Made Them

**Decision: Separate FrictionDetector from widget rendering**

The friction detection logic (`FrictionDetector.ts`) runs independently from the React component. This means friction monitoring starts immediately on page load, before any widget renders. The widget only mounts when friction is detected. This keeps the initial page weight low and avoids unnecessary React rendering on smooth checkouts.

**Decision: Pre-fetch Shopify data at session start, not at trigger**

When the session starts (page load), we immediately fetch the cart data and store policies from Shopify. This adds ~200ms of network overhead at page load but means the AI context is ready the moment friction is detected — no user-visible delay between trigger and the first AI message. The alternative (fetching at trigger time) would add 400–800ms of latency to the most critical moment of the intervention.

**Decision: Structured system prompt over open-ended instructions**

Claude receives a structured system prompt with explicit sections for cart data, friction type, policies, and constraints. We tested two approaches: (a) prose description of the situation, (b) structured JSON-like data with explicit behavioral rules. Option (b) produced more consistent, grounded responses with fewer hallucinations in 20 test runs.

**Decision: Deterministic action layer separate from AI conversation**

When Claude recommends an action (e.g., "I can apply discount code SAVE10 for you"), the widget does not let Claude call Shopify APIs directly. Instead, Claude outputs a structured `action` field in its response JSON, and the backend executes the Shopify mutation independently. This means: (a) Claude cannot accidentally submit wrong API calls, (b) we can validate actions before executing them, (c) the AI/deterministic boundary is clear and auditable.

**Decision: SQLite for development, PostgreSQL schema-compatible**

We use SQLite locally so setup requires zero infrastructure. The ORM (Sequelize) uses the same model definitions for both databases. A production deployment switches to PostgreSQL by changing one environment variable. This was a deliberate tradeoff: faster development setup, production-ready schema.

---

## 3. What AI/LLM Does vs. What Deterministic Code Handles

This boundary is the most important architectural decision in CartSave. We drew it explicitly.

**Claude (LLM) handles:**
- Understanding what the buyer said in natural language
- Mapping buyer concern to friction category if not already detected
- Generating a warm, contextually accurate response
- Deciding which resolution action to recommend
- Knowing when to stop trying and escalate to human support

**Deterministic code handles:**
- Detecting friction signals (pure JavaScript event listeners + threshold logic)
- Fetching cart and store data from Shopify (GraphQL queries)
- Executing Shopify mutations (apply discount, etc.)
- Validating that Claude's recommended action is a real, known action type
- Capping conversation at 8 turns
- Logging session outcomes to database
- All retry and fallback logic

**Why we drew the line here:**

Trust and auditability. A buyer who gets told their discount code was applied needs that to be true. If Claude "decided" to call the Shopify API directly and made a mistake, the buyer would have a bad experience with no audit trail. By keeping all side effects in deterministic code that Claude cannot directly invoke, every action is logged, validated, and reversible.

---

## 4. Failure Handling: What Happens When Things Break

This section documents every failure mode we identified and how the system degrades.

### 4.1 Claude API Timeout or Error

**What we do:**
1. Display "One moment..." typing indicator
2. Wait up to 8 seconds for response
3. If timeout: retry once with same prompt
4. If second timeout: fall back to static response based on friction type

**Static fallback responses by friction type:**
```javascript
const FALLBACK_RESPONSES = {
  shipping: "For shipping details, here's a link to our shipping policy: [link]. Our support team can also help at [email].",
  price: "We do have some ongoing promotions. Let me check... [link to sale page]",
  coupon: "Having trouble with a coupon code? Try [WELCOME10] for first-time orders.",
  trust: "Our return policy is 30 days, no questions asked. [Return policy link]",
  general: "Happy to help — what's on your mind about your order?"
}
```

This ensures the widget always says something useful, even when Claude is unavailable.

### 4.2 Shopify Storefront API Down

**What we do:**
- Cart data is cached in memory on session start
- If the Shopify API is down at session start, we proceed with limited context (product names from localStorage cart data, no real-time shipping rates)
- Claude is informed via system prompt: "Shopify API is currently unavailable. Use general knowledge for shipping estimates. Do not state specific dates."
- Checkout recovery continues with reduced accuracy, not total failure

### 4.3 Malformed or Overly Long Claude Response

**What we do:**
```javascript
function validateClaudeResponse(response) {
  // Strip markdown formatting
  response = response.replace(/[*_`#]/g, '');
  // Truncate if over 200 characters
  if (response.length > 200) {
    response = response.substring(0, 197) + '...';
  }
  // Detect if response contains JSON (malformed output)
  if (response.trim().startsWith('{')) {
    return FALLBACK_RESPONSES[currentFrictionType];
  }
  return response;
}
```

On second consecutive malformed response from same conversation: escalate to human support automatically.

### 4.4 No Friction Detected

The widget does not appear. FrictionDetector runs silently, logs nothing, and the buyer completes checkout normally. We explicitly do not trigger for buyers who are progressing smoothly.

### 4.5 Discount Code Invalid or Already Used

When `applyDiscount` Shopify mutation returns an error:
1. Backend catches the error code from Shopify GraphQL response
2. Returns `{ success: false, reason: "invalid" | "expired" | "already_used" }`
3. Claude is informed in the next turn via a system-injected message: "Discount code [CODE] could not be applied. Reason: [reason]. Offer an alternative: mention free shipping on orders over [threshold]."
4. Claude pivots naturally without exposing technical error to the buyer

### 4.6 Session Expiry (Page Refresh or Tab Return)

- Conversation history is stored in `sessionStorage` (cleared on tab close, survives refresh)
- Session ID is stored in `sessionStorage` too
- On page reload, widget checks for existing session → resumes conversation if session < 30 minutes old
- If session expired on backend (> 30 minutes), a new session starts and conversation resets

### 4.7 Concurrent Messages (User Types Quickly)

Messages are queued. If a user sends two messages before Claude responds to the first:
```javascript
const messageQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  isProcessing = true;
  const message = messageQueue.shift();
  await sendToBackend(message);
  isProcessing = false;
  processQueue();
}
```

This prevents race conditions and ensures conversation history is always coherent.

---

## 5. Known Limitations and What We Would Improve With More Time

**Limitation 1: Behavioral signal detection is heuristic-based**

The FrictionDetector uses time thresholds and event counts, not ML-based intent prediction. A buyer who is a slow typist might trigger "shipping confusion" when they are actually just typing carefully. With more time, we would train a lightweight classifier on real checkout interaction data to improve trigger precision.

**Limitation 2: No real A/B testing**

We demonstrate recovery in the demo, but we cannot prove statistical significance without a control group. A production version would need a proper experiment layer with random assignment and statistical significance testing.

**Limitation 3: Widget is not yet a distributed Shopify app**

The current widget is injected via a theme app extension on a single development store. Making this a distributable Shopify app requires submitting to the Shopify App Store review process, which takes 2–4 weeks. The architecture is identical; the distribution layer is missing.

**Limitation 4: Claude context window grows with conversation**

We send the full conversation history with every API call. At 8 turns (our cap), this is manageable (~1500 tokens). If we raised the cap to 20+ turns, token costs and latency would grow linearly. With more time, we would implement conversation summarization: after turn 4, summarize previous turns before appending new ones.

**Limitation 5: Single language (English)**

The Claude prompt and all UI strings are English-only. A real Shopify app would need to detect the store's primary language and buyer locale, then adjust prompt language and widget text accordingly.

**Limitation 6: No merchant dashboard UI**

We built analytics API endpoints (`/api/analytics/summary`) but the merchant-facing dashboard is not implemented as a full UI — it is accessible only via API response. With more time, we would build a simple React dashboard showing recovery rate, top friction types, and conversation outcomes.

---

## 6. Technology Stack Summary

| Layer | Technology | Reason |
|---|---|---|
| Frontend widget | React + TypeScript | Component isolation, type safety, Shopify theme extension compatibility |
| Styling | Tailwind CSS | Fast iteration, no CSS conflicts with Shopify theme |
| Friction detection | Vanilla JS (no framework) | Runs before React mounts, minimal footprint |
| Backend | Node.js + Express | Fast setup, same language as frontend (shared types), good Shopify SDK support |
| AI | Anthropic Claude (claude-sonnet-4-20250514) | Best-in-class instruction following, low hallucination rate, structured output support |
| Shopify | Storefront API (GraphQL) | Public, no OAuth needed for cart/product reads; Storefront mutations for cart actions |
| Database | SQLite (dev) / PostgreSQL (prod) via Sequelize | Zero-config dev setup, production-ready schema |
| Session state | In-memory (dev) + sessionStorage (client) | Simplicity for hackathon; Redis would be used in production |
