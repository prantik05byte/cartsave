const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Fallback messages by friction type (FAILURE HANDLING #1) ──────────────
const FALLBACK_MESSAGES = {
  price: "I understand price is a consideration. Our products come with a 30-day money-back guarantee. Would a payment plan help?",
  shipping: "We offer standard (5-7 days) and express (2-3 days) shipping. Free shipping on orders over $50!",
  coupon: "It looks like you might have a coupon issue. Try code SAVE10 for 10% off your first order!",
  size: "Not sure about sizing? Our size guide covers all measurements. What's your usual size in similar items?",
  trust: "We've helped over 10,000 customers and have a 30-day hassle-free return policy. What can I clarify?",
  payment: "We accept all major cards, PayPal, and Apple Pay. All transactions are 256-bit SSL encrypted.",
  general: "I noticed you've been here a while — can I help you with anything about your order?",
};

/**
 * Build the system prompt for Claude with full checkout context.
 */
function buildSystemPrompt({ storeName, cartItems, frictionType, policies, discounts, shippingRates }) {
  return `You are a helpful checkout assistant for ${storeName || 'our store'}. A buyer is hesitating at checkout.

CART: ${JSON.stringify(cartItems || [], null, 2)}
DETECTED FRICTION: ${frictionType || 'general'}
STORE POLICIES: ${policies || 'Standard 30-day returns. Free shipping over $50.'}
AVAILABLE DISCOUNTS: ${JSON.stringify(discounts || [], null, 2)}
SHIPPING OPTIONS: ${JSON.stringify(shippingRates || [], null, 2)}

Your job:
1. Open with ONE empathetic, specific question targeting the detected friction
2. Never ask more than 2 questions in a row
3. Resolve the blocker using store data — never hallucinate facts
4. If you can apply a discount or clarify shipping, do so explicitly
5. Guide toward 'Complete Purchase' naturally
6. If you cannot resolve it, offer to connect them with support
7. Keep messages under 60 words. Be warm, not salesy.
8. Output only the message text. No markdown, no formatting.`;
}

/**
 * Strip markdown and truncate if Claude goes rogue (FAILURE HANDLING #3)
 */
function sanitizeResponse(text) {
  if (!text) return null;
  // Strip markdown syntax
  let clean = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\n{2,}/g, ' ')
    .trim();
  // Truncate if absurdly long
  if (clean.length > 200) {
    clean = clean.substring(0, 200).replace(/\s\S+$/, '') + '…';
  }
  return clean;
}

/**
 * Determine suggested client-side actions based on friction type and message content.
 */
function inferActions(frictionType, replyText) {
  const actions = [];
  const lower = (replyText || '').toLowerCase();

  if (frictionType === 'coupon' || lower.includes('discount') || lower.includes('code')) {
    actions.push({ type: 'HIGHLIGHT_COUPON_FIELD' });
  }
  if (frictionType === 'shipping' || lower.includes('shipping') || lower.includes('deliver')) {
    actions.push({ type: 'HIGHLIGHT_SHIPPING_OPTION' });
  }
  if (frictionType === 'trust' || lower.includes('return') || lower.includes('policy')) {
    actions.push({ type: 'SHOW_RETURN_POLICY' });
  }
  if (frictionType === 'size' || lower.includes('size') || lower.includes('fit')) {
    actions.push({ type: 'SHOW_SIZE_GUIDE' });
  }
  if (frictionType === 'payment' || lower.includes('payment') || lower.includes('installment')) {
    actions.push({ type: 'OFFER_INSTALLMENTS' });
  }
  if (lower.includes('support') || lower.includes('contact') || lower.includes('team')) {
    actions.push({ type: 'ESCALATE_TO_SUPPORT' });
  }
  return actions;
}

/**
 * Main Claude API call with full failure handling.
 * FAILURE HANDLING #1: Timeout + retry + fallback
 * FAILURE HANDLING #3: Malformed response sanitization
 * FAILURE HANDLING #7: Rate limit queuing
 */
async function getAIResponse({ sessionId, message, conversationHistory, context }) {
  const { frictionType, cartItems, policies, discounts, shippingRates, storeName } = context || {};

  const systemPrompt = buildSystemPrompt({ storeName, cartItems, frictionType, policies, discounts, shippingRates });

  // Build messages array from conversation history
  const messages = [
    ...(conversationHistory || []).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  // Add the new user message
  if (message) {
    messages.push({ role: 'user', content: message });
  }

  // Attempt API call with timeout and retry
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      // FAILURE HANDLING #1: 15-second timeout
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        system: systemPrompt,
        messages: messages.length > 0 ? messages : [{ role: 'user', content: 'Hello' }],
      });

      clearTimeout(timeout);

      const rawText = response.content?.[0]?.text;
      const sanitized = sanitizeResponse(rawText);

      // FAILURE HANDLING #3: If response still looks malformed, retry with stricter prompt
      if (!sanitized || sanitized.length < 5) {
        if (attempt === 1) {
          console.warn('[Claude] Malformed response on attempt 1, retrying with stricter prompt...');
          continue;
        }
        throw new Error('Malformed response after retry');
      }

      const suggestedActions = inferActions(frictionType, sanitized);

      return {
        reply: sanitized,
        suggestedActions,
        confidence: response.stop_reason === 'end_turn' ? 0.9 : 0.6,
        attempt,
      };

    } catch (err) {
      lastError = err;

      // FAILURE HANDLING #7: Rate limiting — wait and retry
      if (err.status === 429 && attempt === 1) {
        console.warn('[Claude] Rate limited, waiting 2s before retry...');
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (err.name === 'AbortError') {
        console.warn(`[Claude] Timeout on attempt ${attempt}`);
        if (attempt === 1) continue;
      }

      break;
    }
  }

  // FAILURE HANDLING #1: Fallback to static message after all retries fail
  console.error('[Claude] All attempts failed, using fallback:', lastError?.message);
  const fallback = FALLBACK_MESSAGES[frictionType] || FALLBACK_MESSAGES.general;
  return {
    reply: fallback,
    suggestedActions: inferActions(frictionType, fallback),
    confidence: 0.3,
    isFallback: true,
  };
}

module.exports = { getAIResponse };
