# CartSave — Product Document
**Kasparro Agentic Commerce Hackathon | Track 2: AI-Assisted Checkout Recovery**

---

## 1. The Problem We Are Solving and Why It Matters

Cart abandonment is the single largest revenue leak in e-commerce. Industry data consistently shows 70–80% of shopping carts are abandoned before purchase. The dominant recovery mechanism today is a follow-up email sent hours after the buyer has already left — cold, delayed, and impersonal.

But the moment a buyer abandons is not when they leave the site. It is the 60–90 seconds before they leave, when they are staring at the checkout page with an unresolved question in their head:

- "Will this arrive in time for the event?"
- "Is the return policy good enough to take the risk?"
- "Is there a discount code I'm missing?"
- "Which size should I order for my body type?"

These are not vague doubts. They are specific, answerable blockers. No tool currently intercepts them in real time.

CartSave changes that. It is an AI-powered checkout recovery agent that detects friction signals during the checkout session, opens a targeted conversational intervention, and resolves the specific blocker using real store data — before the buyer leaves.

---

## 2. Who the Target User Is and What Their Current Experience Looks Like

**Primary user: The buyer at checkout**

A buyer adds products to cart, reaches the checkout page, and encounters something uncertain — a shipping cost that seems high, a return policy they cannot find, a size guide that is buried three clicks away. They pause. They scroll. They hover over the back button. Currently, nothing happens. The store's checkout page is static. If they leave, the best the merchant can do is send them an email 4 hours later with a 10% discount code, hoping they come back.

**Secondary user: The Shopify merchant**

A small-to-mid-size Shopify merchant running a fashion, electronics, or home goods store. They know they have a high abandonment rate from their Shopify analytics, but they do not know why. They have tried discount popups (intrusive, trains buyers to always wait for a discount), abandoned cart emails (low recovery rate), and live chat (requires always-on human agents). None of these solve the core problem: the buyer had a question that nobody answered in the moment.

**What a merchant wants:**
- Fewer abandoned carts without constantly discounting
- Understanding of *why* buyers are abandoning
- A recovery tool that works automatically, does not require agents, and feels helpful to buyers

---

## 3. What We Decided to Build and the Core User Journey

We built CartSave: a lightweight JavaScript widget that embeds in Shopify checkout pages and runs an AI-powered recovery conversation when it detects friction.

**Core buyer journey:**

1. Buyer reaches Shopify checkout with items in cart
2. CartSave's FrictionDetector runs silently in the background, watching for behavioral signals
3. A specific friction signal is detected (e.g., 40 seconds on the shipping section with no progress)
4. The widget expands in the bottom-right corner with a targeted opening message: *"Looks like you might have a question about shipping — want me to help?"*
5. Buyer responds in natural language
6. CartSave fetches real cart data, shipping rates, and store policies from the Shopify API
7. Claude generates a grounded, specific response (no hallucinated facts)
8. If the blocker is resolved, CartSave shows a "Complete My Purchase →" CTA
9. If not resolvable, CartSave escalates to human support
10. Every session outcome is logged (recovered / abandoned / escalated) for merchant analytics

**Friction types CartSave handles:**

| Friction Type | Detection Signal | Resolution Strategy |
|---|---|---|
| Shipping confusion | 30s+ on shipping field | Show actual delivery date range from Shopify API |
| Price hesitation | Multiple scrolls past price | Surface available discount codes or payment plans |
| Coupon frustration | Coupon field clicked, left empty | Fetch active promotions and apply the best one |
| Size uncertainty | Variant selector revisited 2+ times | Show size guide and reviews mentioning fit |
| Trust gap | Policy section never viewed | Surface return policy text inline |
| Payment confusion | Payment section revisited 2+ times | Explain payment options, surface EMI/BNPL |

---

## 4. Key Product Decisions and the Reasoning Behind Each

**Decision: Real-time intervention, not post-session recovery**

We chose to intercept during the session rather than send a follow-up email. Reason: by the time the email arrives, the buyer's intent has cooled, they may have bought from a competitor, and the discount you offer trains them to always abandon for a deal. In-session recovery preserves the original purchase intent.

**Decision: Behavioral trigger, not a timer-based popup**

We did not use a simple "exit intent popup" or "you've been here for 2 minutes" trigger. We built a friction classifier that maps specific behavioral signals to specific friction types. This means the opening message is always targeted, not generic. A buyer confused about shipping gets a shipping question, not "Can I help you today?"

**Decision: Conversational, not a form**

We specifically did not build a multi-step survey ("What is stopping you? A) Price B) Shipping C) Other"). The document explicitly asks for a recovery conversation, not a survey. CartSave treats every intervention as a real conversation where the AI listens and responds to what the buyer actually says.

**Decision: Ground all responses in Shopify store data**

Claude is instructed to only make claims it can verify from the cart data, product data, and store policies fetched from the Shopify Storefront API. This prevents hallucination of shipping dates, prices, or return terms — which would destroy buyer trust.

**Decision: Show analytics to merchants**

Recovery rate without data is not a product. We built a simple analytics endpoint and dashboard view that shows merchants: total sessions, recovery rate, top friction types, and average conversation length. This gives merchants signal on where their checkout UX is failing.

---

## 5. What We Chose NOT to Build and Why

**Not built: Proactive product recommendations during checkout**

CartSave is focused on completing the purchase the buyer has already decided to make, not upselling. Adding upsell logic during a friction intervention would increase cognitive load and reduce conversion. This is a scope decision, not a capability gap.

**Not built: Multi-language support**

We support English only. Adding language detection and multilingual prompting would have been 2–3 days of additional work with diminishing returns for a hackathon demo. A real product would need it.

**Not built: Native Shopify app (listed in App Store)**

We built a custom app via Shopify Partner Dashboard with the widget injected via a theme app extension. A real Shopify app submission requires a review process incompatible with the hackathon timeline. The architecture, however, is identical to what a listed app would use.

**Not built: A/B testing framework**

Proving recovery rate improvement requires A/B testing against a control group. We simulate this in the demo using two checkout sessions — one with CartSave active, one without — and show the logged outcomes. A production product would need a proper experiment framework.

---

## 6. Tradeoffs Encountered and How We Resolved Them

**Tradeoff: Intervene early vs. wait longer before triggering**

Triggering too early (e.g., at 10 seconds on the page) would interrupt buyers who are just reading normally. Triggering too late means the buyer has already navigated away. We settled on a minimum of 30 seconds of friction-consistent behavior before triggering, combined with a confidence threshold from the friction classifier. Low-confidence signals do not trigger the widget.

**Tradeoff: Widget visibility vs. not being intrusive**

A large, immediate popup is intrusive and would train buyers to dismiss it reflexively (like GDPR cookie notices). A widget that is too subtle would not be noticed. We chose a collapsed-by-default state (small pulsing dot with "Need help?") that expands only on friction detection. The buyer can also dismiss it with a single click.

**Tradeoff: Rich AI context vs. response latency**

More Shopify data in the Claude context means better, more accurate responses — but also slower API calls. We pre-fetch cart and policy data at session start (not at trigger time) so that when friction is detected, the AI has context immediately. The tradeoff: if the cart changes after page load (rare at checkout), the pre-fetched data may be stale. Acceptable for V1.

**Tradeoff: Claude API cost vs. conversation length**

Unlimited conversation length would produce better outcomes but high API costs at scale. We cap conversations at 8 turns. After 8 turns without resolution, CartSave offers escalation to human support. This is a deliberate product decision, not just a cost constraint.
